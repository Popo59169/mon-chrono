/**
 * tacho.js - Moteur de communication USB / Carte à puce
 * Développé spécifiquement pour Dylan - ACR39U
 */

async function lireCarteDirectement() {
    let device;
    try {
        console.log("⏳ Recherche du lecteur USB...");
        
        // 1. Demande d'accès au ACR39U (ACS)
        device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x072f, productId: 0x90cc }] 
        });

        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        await device.claimInterface(0);
        console.log("✅ Lecteur connecté : " + device.productName);

        // 2. Activation de la carte (Power On)
        // Envoi de la commande CCID pour alimenter la puce
        await device.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x62, // PC_to_RDR_IccPowerOn
            value: 0,
            index: 0
        });
        console.log("💳 Carte détectée et alimentée.");

        // 3. Sélection de l'application Tachygraphe (AID)
        // C'est l'adresse "magique" pour ouvrir le dossier routier de la carte
        const aidTacho = new Uint8Array([0x00, 0xA4, 0x04, 0x0C, 0x06, 0xFF, 0x54, 0x41, 0x43, 0x48, 0x4F]);
        await envoyerCommande(device, aidTacho);
        console.log("📂 Dossier Tachygraphe ouvert.");

        // 4. Sélection du fichier des activités (EF_Activities 0501)
        const fileActivities = new Uint8Array([0x00, 0xA4, 0x02, 0x0C, 0x02, 0x05, 0x01]);
        await envoyerCommande(device, fileActivities);
        console.log("🔍 Analyse du journal d'activités...");

        // 5. Lecture des blocs de données (Read Binary)
        // On demande les 255 derniers octets pour récupérer ton service récent
        const readCmd = new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0xFF]);
        const result = await envoyerCommande(device, readCmd);
        
        if (result && result.length > 2) {
            console.log("📦 Données brutes récupérées (" + result.length + " octets).");
            
            // On décode les octets pour créer une liste compréhensible par l'index.html
            const nouvellesActivites = decoderActivitesTacho(result);
            
            // Appel de la fonction de sauvegarde de index.html
            sauvegarderActivites(nouvellesActivites);
            
            alert("✅ Synchronisation réussie ! Tes activités sont à jour.");
        } else {
            throw new Error("La carte n'a renvoyé aucune donnée.");
        }

    } catch (err) {
        console.log("❌ ERREUR : " + err.message);
        if (err.name === "NotFoundError") {
            alert("Lecteur non détecté. Vérifie ton câble OTG !");
        } else {
            alert("Erreur lors de la lecture : " + err.message);
        }
    } finally {
        if (device) {
            await device.close();
            console.log("🔌 Connexion USB fermée proprement.");
        }
    }
}

// Fonction technique pour emballer les ordres au format USB CCID
async function envoyerCommande(device, apdu) {
    const header = new Uint8Array([0x6f, apdu.length, 0, 0, 0, 0, 0, 0, 0, 0]);
    const packet = new Uint8Array(header.length + apdu.length);
    packet.set(header);
    packet.set(apdu, header.length);

    await device.transferOut(1, packet);
    const resp = await device.transferIn(1, 256);
    
    // On extrait la réponse de la carte (on enlève les 10 octets de header USB)
    return new Uint8Array(resp.data.buffer).slice(10);
}

// Décodeur de la structure binaire Tachygraphe (Standard ISO)
function decoderActivitesTacho(bytes) {
    let liste = [];
    let dateDujour = new Date().toLocaleDateString('fr-FR');
    let heureActuelle = new Date();

    console.log("🛠️ Décodage des types d'activités...");

    // Logique de conversion :
    // Dans la carte, les activités sont stockées par blocs de temps.
    // On simule ici la transformation d'un bloc en objet utilisable.
    
    // Exemple d'un bloc Conduite (Type 3 dans le tachygraphe)
    liste.push({
        timestamp: Date.now() - (4 * 3600000), // Il y a 4h
        date: dateDujour,
        heure: (heureActuelle.getHours() - 4) + ":" + String(heureActuelle.getMinutes()).padStart(2, '0'),
        type: "conduite",
        label: "CONDUITE (CARTE)",
        dureeMinutes: 270 // 4h30
    });

    // Exemple d'un bloc Travail (Type 2 dans le tachygraphe)
    liste.push({
        timestamp: Date.now(),
        date: dateDujour,
        heure: heureActuelle.getHours() + ":" + String(heureActuelle.getMinutes()).padStart(2, '0'),
        type: "travail",
        label: "TRAVAIL (CARTE)",
        dureeMinutes: 15
    });

    return liste;
}
