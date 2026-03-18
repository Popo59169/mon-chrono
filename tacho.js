// tacho.js - Analyseur de frais et heures de nuit
async function traiterDonneesCarte(device) {
    // Simulation de l'extraction des blocs d'activité du lecteur ACS
    // Dans une version réelle, on décode les octets du protocole CCID
    
    const donneesSession = {
        date: new Date().toLocaleDateString('fr-FR'),
        debut: "20:30", // Exemple extrait de la carte
        fin: "05:45",   // Exemple extrait de la carte
        dureeNuit: 495, // Minutes entre 21h et 6h (8h15)
        coupureNuit: 45, // Tes temps de repos pendant la nuit
        tauxFrais: "Grand Déplacement" // Calculé selon l'amplitude
    };

    // Calcul net des heures de nuit (Travail effectif - Coupures)
    const nuitNet = (donneesSession.dureeNuit - donneesSession.coupureNuit) / 60;
    
    return {
        ...donneesSession,
        nuitNet: nuitNet.toFixed(2)
    };
}
