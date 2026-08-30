import { getState, resolveRole } from '../lib/kv.js';
import { otherOf, buildPartnerView } from '../lib/domain.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const role = resolveRole(req);
  if (!role) { res.status(401).json({ error: 'invalid_token' }); return; }

  try {
    const state = await getState();
    const other = otherOf(role);
    res.status(200).json({
      role,
      onboarded: state.onboarded[role],
      me: state.users[role],
      partner: buildPartnerView(state, other),
      shared: state.shared,
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: String(err && err.message || err) });
  }
}
