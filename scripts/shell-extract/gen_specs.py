# python gen_specs.py — write specs/<domain>.json for every clustered domain (domains.json), keeping each existing
# spec's header / port / exports. Mirrors and the shell's own plumbing never move.
import json, os
T = os.path.dirname(os.path.abspath(__file__)) + '/'
g = json.load(open(T + 'shell-graph.json', encoding='utf8'))['members']
dom = json.load(open(T + 'domains.json', encoding='utf8'))
# Types of foreign members the tool cannot read off their declarations (a defaulted parameter, an unannotated return).
PORT_TYPES = {
    'foldWorkspaceAfterResult': 'foldWorkspaceAfterResult(host?: WorkspaceFrameKind): void',
}
STAY = {'shellPortsConform', 'submit', 'submitBatch'}
MODULE = {'supervisor': 'src/client/console/supervisor/supervisorController.ts'}
for d, names in dom.items():
    if d == 'core':
        continue
    p = T + 'specs/%s.json' % d
    spec = json.load(open(p, encoding='utf8')) if os.path.exists(p) else {}
    spec['name'] = d
    spec['module'] = MODULE.get(d, 'src/client/console/shell/%sController.ts' % d)
    spec['members'] = [n for n in names if not g[n]['mirror'] and n not in STAY]
    spec.setdefault('port', {})
    spec['port'].pop('playerView', None)
    spec['port'].setdefault('thisPlayer', 'PublicPlayerModel')
    for k, v in PORT_TYPES.items():
        spec['port'][k] = v
    json.dump(spec, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('specs:', ' '.join(d for d in dom if d != 'core'))
