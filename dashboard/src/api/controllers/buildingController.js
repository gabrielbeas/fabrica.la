import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../../data/building.json');

let building = {};

// Cargar información del edificio
async function loadBuilding() {
  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    building = JSON.parse(data);
  } catch (error) {
    console.log('Archivo de edificio no encontrado, iniciando vacío');
    building = {};
  }
}

// Guardar información del edificio
async function saveBuilding() {
  try {
    await fs.writeFile(dataPath, JSON.stringify(building, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error guardando edificio:', error);
    throw error;
  }
}

loadBuilding();

export const getBuilding = (req, res) => {
  try {
    res.json({
      success: true,
      data: building
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener información del edificio' });
  }
};

export const updateBuilding = async (req, res) => {
  try {
    building = {
      ...building,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    await saveBuilding();

    res.json({
      success: true,
      data: building,
      message: 'Información del edificio actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando edificio:', error);
    res.status(500).json({ error: 'Error al actualizar información del edificio' });
  }
};
