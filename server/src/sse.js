// clients : Map<userId, Set<res>>
const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  }
}

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, set] of clients) {
    for (const client of set) {
      try { client.write(message); } catch { set.delete(client); }
    }
  }
}

function broadcastToUser(userId, event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const set = clients.get(userId);
  if (!set) return;
  for (const client of set) {
    try { client.write(message); } catch { set.delete(client); }
  }
}

module.exports = { addClient, removeClient, broadcast, broadcastToUser };
