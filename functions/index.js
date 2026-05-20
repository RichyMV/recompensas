const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

exports.getCustomerPoints = onRequest({ cors: true, secrets: ["LOYVERSE_TOKEN"], invoker: "public" }, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;

    if (!phone) return res.status(400).json({ error: "Sin teléfono" });

    // Extraer solo los dígitos del teléfono (sin +52)
    const digits = phone.replace(/\D/g, '');
    const localPhone = digits.startsWith('52') ? digits.slice(2) : digits;

    const loyverseToken = process.env.LOYVERSE_TOKEN;

    // Loyverse API: listar clientes y buscar por teléfono
    let cursor = null;
    let found = null;

    while (!found) {
      const url = cursor
        ? `https://api.loyverse.com/v1.0/customers?cursor=${cursor}`
        : `https://api.loyverse.com/v1.0/customers?limit=250`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${loyverseToken}` }
      });

      const data = await response.json();

      if (!data.customers || data.customers.length === 0) break;

      // Buscar coincidencia por teléfono (comparar últimos 10 dígitos)
      found = data.customers.find(c => {
        if (!c.phone_number) return false;
        const cDigits = c.phone_number.replace(/\D/g, '');
        return cDigits.endsWith(localPhone) || localPhone.endsWith(cDigits);
      });

      cursor = data.cursor;
      if (!cursor) break;
    }

    if (found) {
      return res.json({
        name: found.name,
        points: found.total_points || 0,
        customer_id: found.id,
        visits: found.total_visits || 0
      });
    }

    return res.status(404).json({ error: "Cliente no encontrado", phone_searched: localPhone });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
