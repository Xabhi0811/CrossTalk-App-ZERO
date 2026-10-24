/**
 * PeerJS connection service for room-based P2P communication.
 */
import Peer from 'peerjs';

const PEER_PREFIX = 'xtalk';
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

/**
 * Generate a peer ID from room code and role.
 */
function makePeerId(roomCode, role) {
  return `${PEER_PREFIX}-${roomCode.toLowerCase()}-${role}`;
}

/**
 * Create a PeerJS connection manager.
 * @param {Object} options
 * @param {string} options.roomCode
 * @param {string} options.role - 'a' or 'b'
 * @param {Function} options.onOpen - Called when peer is ready
 * @param {Function} options.onConnect - Called when partner connects
 * @param {Function} options.onData - Called with received data
 * @param {Function} options.onDisconnect - Called when partner disconnects
 * @param {Function} options.onError - Called with error info
 * @param {Function} options.onReconnecting - Called during reconnection attempts
 */
export function createPeerConnection(options) {
  const { roomCode, role, onOpen, onConnect, onData, onDisconnect, onError, onReconnecting } = options;
  
  let peer = null;
  let connection = null;
  let destroyed = false;
  let reconnectAttempts = 0;

  const ownId = makePeerId(roomCode, role);
  const partnerId = makePeerId(roomCode, role === 'a' ? 'b' : 'a');

  function wireConnection(conn) {
    connection = conn;

    const handleOpen = () => {
      reconnectAttempts = 0;
      onConnect(conn);
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
      if (data && typeof data === 'object') {
        onData(data);
      }
    });

    conn.on('close', () => {
      connection = null;
      if (!destroyed) {
        onDisconnect();
        attemptReconnect();
      }
    });

    conn.on('error', (err) => {
      onError(err?.type === 'peer-unavailable'
        ? 'Room not found. Ask the host to create it first.'
        : `Connection error: ${err?.message || 'Unknown error'}`
      );
    });
  }

  function attemptReconnect() {
    if (destroyed || reconnectAttempts >= RECONNECT_ATTEMPTS || !peer || peer.destroyed) return;
    
    reconnectAttempts++;
    onReconnecting(reconnectAttempts, RECONNECT_ATTEMPTS);

    setTimeout(() => {
      if (destroyed || !peer || peer.destroyed) return;
      
      if (role === 'b') {
        // Joiner reconnects to host
        try {
          const conn = peer.connect(partnerId, { reliable: true, serialization: 'json' });
          wireConnection(conn);
        } catch {
          if (reconnectAttempts < RECONNECT_ATTEMPTS) attemptReconnect();
        }
      }
      // Host (role 'a') waits for incoming connections
    }, RECONNECT_DELAY * reconnectAttempts);
  }

  function init() {
    try {
      peer = new Peer(ownId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      });
    } catch (err) {
      onError('Failed to create peer connection. Check your network.');
      return;
    }

    peer.on('open', () => {
      onOpen(peer);

      if (role === 'b') {
        // Joiner connects to host
        try {
          const conn = peer.connect(partnerId, { reliable: true, serialization: 'json' });
          wireConnection(conn);
        } catch (err) {
          onError('Failed to connect to room. Check the room code.');
        }
      }
    });

    // Host accepts incoming connections
    peer.on('connection', (conn) => {
      wireConnection(conn);
    });

    peer.on('disconnected', () => {
      if (!destroyed && peer && !peer.destroyed) {
        try { peer.reconnect(); } catch { /* ignore */ }
      }
    });

    peer.on('error', (err) => {
      const errType = err?.type;
      if (errType === 'unavailable-id') {
        onError('That room code is already active. Try a new code.');
      } else if (errType === 'peer-unavailable') {
        onError('Room not found yet. Ask the host to create it first.');
      } else if (errType === 'network' || errType === 'server-error') {
        onError('Network issue. Check your connection and try again.');
      } else {
        onError(`Connection error: ${err?.message || 'Unknown'}`);
      }
    });
  }

  function send(data) {
    if (connection && connection.open) {
      try {
        connection.send(data);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function destroy() {
    destroyed = true;
    try { connection?.close?.(); } catch { /* ignore */ }
    try { peer?.destroy?.(); } catch { /* ignore */ }
    connection = null;
    peer = null;
  }

  function isConnected() {
    return connection?.open === true;
  }

  init();

  return { send, destroy, isConnected };
}
