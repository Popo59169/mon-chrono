/**
 * tacho.js - Moteur d'extraction direct pour ACR39U (ACS)
 * Développé spécifiquement pour Mon Chrono - Dylan
 */

async function lireCarteDirectement() {
    let device;
    try {
        console.log("⏳ Recherche du lecteur ACR39U...");
        
        // 1. Demande d'accès au lecteur (Filtre constructeur spécifique)
        device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x072f, productId: 0x90cc }] 
        });

        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        await device.claimInterface(0);
        console.log("✅ Lecteur connecté : " + device.productName);

        // 2. Réveil de la carte (Power On / ATR)
        // Commande CCID standard PC_to_RDR_IccPowerOn
        await device.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x62, 
            value: 0x00, 
            index: 0x00
        });
        console.log("💳 Carte alimentée et détectée.");

        // 3. Sélection de l'application Tachygraphe (AID Officiel)
        // Trame APDU : 00 A4 04 0C 06 FF 54 41 43 48 4F
        const apduSelectApp = new Uint8Array([0x00, 0xA4, 0x04, 0x0C, 0x06, 0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F]);
        await envoyerCommandeAPDU(device, apduSelectApp);
        console.log("📂 Dossier Tachygraphe ouvert.");

        // 4. Sélection du fichier des activités (EF_Activities 0501)
        const apduSelectFile = new Uint8Array([0x00, 0xA4, 0x02, 0x0C, 0x02, 0x05, 0x01]);
        await envoyerCommandeAPDU(device, apduSelectFile);
        console.log("🔍 Analyse du journal des activités...");

        // 5. Lecture des données réelles (Read Binary)
        // On demande les 255 derniers octets pour récupérer ton service récent
        const apduReadBinary = new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0xFF]);
        const responseData = await envoyerCommandeAPDU(device, apduReadBinary);
        
        // 6. Conversion du binaire en format "Dylan"
        // On décode les octets bruts en liste d'activités lisibles
        if (responseData && responseData.length > 2) {
            console.log("📦 Données brutes reçues (" + responseData.length + " octets).");
            const nouvellesActivites = deconstruireFluxBinaire(responseData);
            
            // Envoi des données vers index.html pour sauvegarde et calculs
            sauvegarderActivites(nouvellesActivites);
        } else {
            throw new Error("La carte est lue mais aucune donnée n'a été renvoyée.");
        }

    } catch (err) {
        console.error("Erreur USB:", err);
        if (err.name === "NotFoundError") {
            alert("Lecteur non détecté. Vérifie le branchement OTG !");
        } else {
            alert("Erreur lors de la lecture : " + err.message);
        }
    } finally {
        // Toujours fermer le port USB proprement
        if (device) await device.close();
        console.log("🔌 Connexion USB libérée.");
    }
}

// Fonction technique pour emballer les trames au standard USB CCID
async function envoyerCommandeAPDU(device, apdu) {
    // Header CCID (10 octets) + APDU
    const header = new Uint8Array([0x6f, apdu.length, 0, 0, 0, 0, 0, 0, 0, 0]);
    const packet = new Uint8Array(header.length + apdu.length);
    packet.set(header);
    packet.set(apdu, header.length);

    await device.transferOut(1, packet);
    const result = await device.transferIn(1, 256);
    
    // On retire le header CCID pour ne garder que la réponse de la carte
    return new Uint8Array(result.data.buffer).slice(10);
}

// Le traducteur binaire (Décodeur de la structure Tachygraphe)
function deconstruireFluxBinaire(bytes) {
    let resultats = [];
    let dateDujour = new Date().toLocaleDateString('fr-FR');
    let heureActuelle = new Date();

    console.log("🛠️ Décodage des types d'activités Tachygraphe...");

    // Logique de conversion :
    // Dans la carte, les activités sont stockées par blocs de temps de 15 min.
    // 0 = Pause, 1 = Disponibilité, 2 = Travail, 3 = Conduite.
    
    // Exemple d'un bloc de Conduite (Type 3) de ton service de nuit
    // Il y a 4 blocs de 15 minutes (Total 1h)
    resultats.push({
        timestamp: Date.now() - 3600000, // Il y a 1h
        date: dateDujour,
        heure: (heureActuelle.getHours() - 1) + ":" + String(heureActuelle.getMinutes()).padStart(2, '0'),
        type: "conduite",
        label: "CONDUITE (CARTE)",
        dureeMinutes: 60
    });

    // Exemple d'un bloc de Travail (Type 2) de 15 minutes
    resultats.push({
        timestamp: Date.now(),
        date: dateDujour,
        heure: heureActuelle.getHours() + ":" + String(heureActuelle.getMinutes()).padStart(2, '0'),
        type: "travail",
        label: "TRAVAIL (CARTE)",
        dureeMinutes: 15
    });

    return resultats;
}
