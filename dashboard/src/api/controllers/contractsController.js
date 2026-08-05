import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../../data/contracts.json');

let contracts = [];

// Cargar contratos al iniciar
async function loadContracts() {
  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    contracts = JSON.parse(data);
  } catch (error) {
    console.log('Archivo de contratos no encontrado, iniciando vacío');
    contracts = [];
  }
}

// Guardar contratos
async function saveContracts() {
  try {
    await fs.writeFile(dataPath, JSON.stringify(contracts, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error guardando contratos:', error);
    throw error;
  }
}

loadContracts();

export const getContracts = (req, res) => {
  try {
    res.json({
      success: true,
      data: contracts,
      total: contracts.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const getContractById = (req, res) => {
  try {
    const { id } = req.params;
    const contract = contracts.find(c => c.id === parseInt(id));

    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
};

export const createContract = async (req, res) => {
  try {
    const newContract = {
      id: Math.max(...contracts.map(c => c.id || 0), 0) + 1,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    contracts.push(newContract);
    await saveContracts();

    res.status(201).json({
      success: true,
      data: newContract,
      message: 'Contrato creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando contrato:', error);
    res.status(500).json({ error: 'Error al crear contrato' });
  }
};

export const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const index = contracts.findIndex(c => c.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    contracts[index] = {
      ...contracts[index],
      ...req.body,
      id: contracts[index].id,
      createdAt: contracts[index].createdAt,
      updatedAt: new Date().toISOString()
    };

    await saveContracts();

    res.json({
      success: true,
      data: contracts[index],
      message: 'Contrato actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando contrato:', error);
    res.status(500).json({ error: 'Error al actualizar contrato' });
  }
};

export const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    const index = contracts.findIndex(c => c.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const deleted = contracts.splice(index, 1)[0];
    await saveContracts();

    res.json({
      success: true,
      data: deleted,
      message: 'Contrato eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando contrato:', error);
    res.status(500).json({ error: 'Error al eliminar contrato' });
  }
};
