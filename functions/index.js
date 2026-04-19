/**
 * functions/index.js — Serviço de Backup do Firestore
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const firestore = require("@google-cloud/firestore");

admin.initializeApp();
const client = new firestore.v1.FirestoreAdminClient();

exports.backupFirestore = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas usuários logados podem agendar backups.");
    }

    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId, "(default)");
    
    // Substitua pelo nome do bucket que você vai criar/criou
    const bucket = `gs://kcs-system-180db-backups`; 

    try {
        const responses = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: bucket,
        });
        
        return { 
            success: true, 
            message: "Backup iniciado com sucesso no servidor.",
            operation: responses[0].name 
        };
    } catch (error) {
        console.error("Erro no backup:", error);
        throw new HttpsError("internal", "Falha ao exportar banco de dados.", error.message);
    }
});