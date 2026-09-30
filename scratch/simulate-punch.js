const axios = require('axios');

// Configuration
const WEBHOOK_URL = 'http://localhost:3000/api/v1/biotime/webhook';
const EMP_CODE = '10025'; // Remplacez par le matricule d'un enfant existant
const TERMINAL_SN = 'BUS-TEST-001'; // Numéro de série de la badgeuse simulée

async function simulatePunch(state) {
  const payload = {
    emp_code: EMP_CODE,
    punch_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    punch_state: state, // 0 = Check-In (Montée), 1 = Check-Out (Descente)
    verify_type: 1, // 1 = Empreinte
    terminal_sn: TERMINAL_SN,
  };

  try {
    console.log(`Envoi du pointage simulé pour l'enfant ${EMP_CODE}...`);
    const response = await axios.post(WEBHOOK_URL, payload);
    console.log('Succès ! Réponse du serveur :', response.data);
  } catch (error) {
    console.error('Erreur lors de la simulation :', error.message);
  }
}

// Simuler une Montée immédiatement
simulatePunch('0');

// Décommentez pour simuler une descente 5 secondes plus tard
/*
setTimeout(() => {
  simulatePunch('1');
}, 5000);
*/
