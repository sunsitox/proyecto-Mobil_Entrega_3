const express = require("express");
const jsonServer = require("json-server");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const enviarCorreo = require("./mailer"); // Asegúrate de que este archivo sea correcto
const port = process.env.PORT || 10000;

// Crear servidor y middlewares
const server = express();
const router = jsonServer.router("Data.json");
const middlewares = jsonServer.defaults();
const dataFilePath = path.join(__dirname, "Data.json");

// Middleware para parsear el cuerpo de las solicitudes
server.use(express.json());
server.use(cors({
  origin: "*", // Cambiar a origen específico en producción
  credentials: true,
}));

// Validar existencia de Data.json y crearlo si no existe
if (!fs.existsSync(dataFilePath)) {
  console.error("Archivo Data.json no encontrado. Creando uno nuevo...");
  fs.writeFileSync(dataFilePath, JSON.stringify({ passwordRequests: [], usuarios: [] }, null, 2));
}

// Ruta para actualizar solo la contraseña basado en el correo
server.put("/usuarios", async (req, res) => {
  console.log("PUT /usuarios recibido:", req.body); // Depuración
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Faltan datos necesarios." });
  }

  try {
    // Leer archivo Data.json
    const data = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
    const usuarios = data.usuarios || [];

    // Buscar usuario por email
    const userIndex = usuarios.findIndex((user) => user.email === email);
    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Actualizar la contraseña del usuario
    usuarios[userIndex].password = password;
    data.usuarios = usuarios;

    // Guardar cambios en Data.json
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`[${new Date().toISOString()}] - Contraseña actualizada para el usuario: ${email}`);

    return res.status(200).json({ message: "Contraseña actualizada con éxito." });
  } catch (error) {
    console.error("Error al actualizar la contraseña:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Ruta para recuperación de contraseña
server.post("/passwordResetRequest", async (req, res) => {
  console.log("Datos recibidos del cliente:", req.body); // Log para debug
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({ error: "Correo electrónico requerido." });
  }

  const token = Math.random().toString(36).substr(2);
  const isValid = true; // Indicador para comprobar si el token es válido
  const resetLink = `http://localhost:8100/reset-password?email=${encodeURIComponent(email)}&token=${token}&isValid=${isValid}`;

  const dataToSave = { email, token, isValid, createdAt: new Date().toISOString() };
  const asunto = "Recuperación de Contraseña";
  const mensaje = `<h1>Recuperación de Contraseña</h1><p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><a href="${resetLink}">Restablecer Contraseña</a>`;

  try {
    await enviarCorreo(email, asunto, mensaje);
    console.log(`[${new Date().toISOString()}] - Correo enviado con éxito a ${email}`);

    const currentData = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
    currentData.passwordRequests = currentData.passwordRequests || [];
    currentData.passwordRequests.push(dataToSave);
    fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2));

    return res.status(200).json({
      message: "Correo enviado con éxito y solicitud registrada.",
      resetLink: resetLink, // Incluimos el link en la respuesta para facilitar pruebas
    });
  } catch (error) {
    console.error("Error al enviar correo o guardar datos:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Middlewares predeterminados de JSON Server y rutas adicionales
server.use(middlewares);
server.use(router);

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
