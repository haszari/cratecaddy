# MongoDB published loopback-only

**Question:** On which network interfaces should the MongoDB container's port be reachable?

Both compose files publish the port as `127.0.0.1:${MONGO_PORT}:27017` — loopback only. The unauthenticated MongoDB is reachable from the macOS host alone, never from the LAN or the internet.

The API and import scripts connect via `127.0.0.1`, so loopback binding changes nothing for local use. Docker's default of binding to all interfaces (`0.0.0.0`) would expose the unauthenticated database to every device on the network for no benefit — the appliance's API and database always live on the same host.

This is the deliberate line to change if remote access is ever required (documented in the plan).

Rejected alternative: **Publish to all interfaces.** No consumer of the database runs on another machine in this architecture, so an open port is pure attack surface. If remote access is ever needed, binding to a specific interface and adding auth would be a separate decision.
