const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

// Cloud Function: busca cliente en Loyverse por teléfono y devuelve sus puntos
exports.getCustomerPoints = onRequest({ cors: true, secrets: ["LOYVERSE_TOKEN"] }, async (req, res) => {
  // Verificar que el usuario esté autenticado
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    // Verificar token de Firebase Auth
    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;

    if (!phone) return res.status(400).json({ error: "Sin teléfono" });

    // Llamar a Loyverse API
    const loyverseToken = process.env.LOYVERSE_TOKEN;
    const response = await fetch(
      `https://api.loyverse.com/v1.0/customers?phone_number=${encodeURIComponent(phone)}`,
      { headers: { Authorization: `Bearer ${loyverseToken}` } }
    );

    const data = await response.json();

    if (data.customers && data.customers.length > 0) {
      const customer = data.customers[0];
      return res.json({
        name: customer.name,
        points: customer.total_points || 0,
        customer_id: customer.id,
        visits: customer.total_visits || 0
      });
    }

    return res.status(404).json({ error: "Cliente no encontrado en Loyverse" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
