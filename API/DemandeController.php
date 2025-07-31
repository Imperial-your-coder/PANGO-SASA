<?php
require_once './login/Database.php';
header('Content-Type: application/json');

class DemandeController {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function createDemande($data) {
        try {
            // 1. Vérifier les données
            $required = ['id_parcelle', 'id_agent', 'justification'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    throw new Exception("Champ manquant: $field");
                }
            }

            // 2. Vérifier les doublons
            $stmt = $this->db->prepare("
                SELECT id FROM demandes_autorisation 
                WHERE id_parcelle = ? AND statut = 'en_attente'
            ");
            $stmt->execute([$data['id_parcelle']]);
            
            if ($stmt->fetch()) {
                throw new Exception('Une demande est déjà en cours pour cette parcelle');
            }

            // 3. Enregistrer la demande
            $stmt = $this->db->prepare("
                INSERT INTO demandes_autorisation 
                (id_parcelle, id_agent, justification , date_demande, statut)
                VALUES (?, ?, ?, NOW(), 'en_attente')
            ");
            $success = $stmt->execute([
                $data['id_parcelle'],
                $data['id_agent'],
                $data['justification']
            ]);

            if (!$success) {
                throw new Exception('Erreur lors de l\'enregistrement');
            }

            return ['success' => true, 'message' => 'Demande enregistrée'];

        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function checkDemandeStatus($parcelId) {
        try {
            $stmt = $this->db->prepare("
                SELECT statut FROM demandes_autorisation 
                WHERE id_parcelle = ? 
                ORDER BY date_demande DESC 
                LIMIT 1
            ");
            $stmt->execute([$parcelId]);
            $result = $stmt->fetch();

            return [
                'success' => true,
                'status' => $result ? $result['statut'] : null
            ];

        } catch (PDOException $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

// Gestion des routes
$action = $_GET['action'] ?? '';
$controller = new DemandeController();

if ($action === 'create') {
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->createDemande($data));
    
} elseif ($action === 'check_status') {
    $parcelId = $_GET['parcel_id'] ?? null;
    echo json_encode($controller->checkDemandeStatus($parcelId));
    
} else {
    echo json_encode(['success' => false, 'message' => 'Action non valide']);
}
?>