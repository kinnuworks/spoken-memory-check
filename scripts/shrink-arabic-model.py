# Stores the Arabic decoder's token-embedding table (51,865 x 768, 159 MB as 32-bit floats; the
# 4-bit build leaves it unquantized) in fewer bits, restored by standard ONNX operators when the
# model loads. Everything else is unchanged.
#   bits=8: 8-bit integers, one scale per row (DequantizeLinear). Decoder 114 MB.
#   bits=4: 4-bit integers packed two to a byte, one 16-bit scale per block of 64 (Mod, BitShift,
#           Concat, Cast, Sub, Mul). Decoder about 95 MB, so it fits a static host's 100 MB file limit.
#   external/ort-venv/bin/python -I scripts/shrink-arabic-model.py <decoder_model_merged_q4.onnx> <out.onnx> [8|4]
import sys
import numpy as np
import onnx
from onnx import helper, numpy_helper

src, out = sys.argv[1], sys.argv[2]
m = onnx.load(src)
NAME = 'model.decoder.embed_tokens.weight_merged_0'
init = next(t for t in m.graph.initializer if t.name == NAME)
w = numpy_helper.to_array(init).astype(np.float32)
scale = np.maximum(np.abs(w).max(axis=1), 1e-12) / 127.0
q = np.clip(np.round(w / scale[:, None]), -127, 127).astype(np.int8)
err = np.abs(q.astype(np.float32) * scale[:, None] - w)
print('max abs error', float(err.max()), 'mean abs error', float(err.mean()), 'mean abs weight', float(np.abs(w).mean()))

bits = int(sys.argv[3]) if len(sys.argv) > 3 else 8
m.graph.initializer.remove(init)
if bits == 8:
    m.graph.initializer.extend([
        numpy_helper.from_array(q, NAME + '_int8'),
        numpy_helper.from_array(scale.astype(np.float32), NAME + '_scale'),
        numpy_helper.from_array(np.zeros(len(scale), dtype=np.int8), NAME + '_zero'),
    ])
    nodes = [helper.make_node('DequantizeLinear', [NAME + '_int8', NAME + '_scale', NAME + '_zero'], [NAME], axis=0, name='embed_tokens_dequantize')]
else:
    B = 64
    rows, cols = w.shape
    blocks = w.reshape(rows, cols // B, B)
    s4 = (np.maximum(np.abs(blocks).max(axis=2), 1e-12) / 7.0).astype(np.float16)
    q4 = np.clip(np.round(blocks / s4.astype(np.float32)[:, :, None]), -8, 7).astype(np.int16) + 8
    q4 = q4.reshape(rows, cols).astype(np.uint8)
    packed = (q4[:, 0::2] | (q4[:, 1::2] << 4)).astype(np.uint8)
    back = ((q4.astype(np.float32) - 8).reshape(rows, cols // B, B) * s4.astype(np.float32)[:, :, None]).reshape(rows, cols)
    e4 = np.abs(back - w)
    print('4-bit: max abs error', float(e4.max()), 'mean abs error', float(e4.mean()))
    c = lambda name, arr: numpy_helper.from_array(np.array(arr), NAME + name)
    m.graph.initializer.extend([
        numpy_helper.from_array(packed, NAME + '_q4'),
        numpy_helper.from_array(s4[:, :, None], NAME + '_s16'),
        c('_sixteen', np.uint8(16)), c('_four', np.uint8(4)), c('_eight', np.float32(8)),
        c('_ax2', np.array([2], dtype=np.int64)),
        c('_shape_flat', np.array([rows, cols], dtype=np.int64)),
        c('_shape_blocks', np.array([rows, cols // B, B], dtype=np.int64)),
    ])
    P = NAME + '_'
    nodes = [
        helper.make_node('Mod', [P + 'q4', P + 'sixteen'], [P + 'lo']),
        helper.make_node('BitShift', [P + 'q4', P + 'four'], [P + 'hi'], direction='RIGHT'),
        helper.make_node('Unsqueeze', [P + 'lo', P + 'ax2'], [P + 'lo3']),
        helper.make_node('Unsqueeze', [P + 'hi', P + 'ax2'], [P + 'hi3']),
        helper.make_node('Concat', [P + 'lo3', P + 'hi3'], [P + 'pairs'], axis=2),
        helper.make_node('Reshape', [P + 'pairs', P + 'shape_blocks'], [P + 'qb']),
        helper.make_node('Cast', [P + 'qb'], [P + 'qf'], to=onnx.TensorProto.FLOAT),
        helper.make_node('Sub', [P + 'qf', P + 'eight'], [P + 'centred']),
        helper.make_node('Cast', [P + 's16'], [P + 's32'], to=onnx.TensorProto.FLOAT),
        helper.make_node('Mul', [P + 'centred', P + 's32'], [P + 'wb']),
        helper.make_node('Reshape', [P + 'wb', P + 'shape_flat'], [NAME]),
    ]
for k, n in enumerate(nodes):
    m.graph.node.insert(k, n)
onnx.checker.check_model(m)
onnx.save(m, out)
print('saved', out)
