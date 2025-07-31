<?php
require_once './login/Database.php';

header('Content-Type: application/json');

class AuthController {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function chiffrer($texte, $cle = 5) {
        $texte_chiffre = "";
        for ($i = 0; $i < strlen($texte); $i++) {
            $car = $texte[$i];
            $code = ord($car);
            $code_chiffre = $code + $cle;
            $texte_chiffre .= dechex($code_chiffre);
        }
        return $texte_chiffre;
    }

    // Créer un utilisateur (admin ou agent)
    public function createUser($data) {
        $required = ['name', 'email', 'password', 'role'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return ['success' => false, 'message' => "Le champ $field est requis"];
            }
        }

        try {
            // Vérifier si l'email existe déjà
            $stmt = $this->db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$data['email']]);
            if ($stmt->fetch()) {
                return ['success' => false, 'message' => 'Cet email est déjà utilisé'];
            }

            $stmt = $this->db->prepare("
                INSERT INTO users (name, email, password, role, phone, matricule) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $success = $stmt->execute([
                $data['name'],
                $data['email'],
                $this->chiffrer($data['password']),
                $data['role'],
                $data['phone'] ?? null,
                $data['matricule'] ?? null
            ]);

            return [
                'success' => $success, 
                'message' => $success ? 'Utilisateur créé avec succès' : 'Échec de la création'
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur de base de données: ' . $e->getMessage()
            ];
        }
    }

    // Lister uniquement les agents (avec gestion des valeurs nulles)
    public function listAgents() {
        try {
            $stmt = $this->db->prepare("
                SELECT id, name, email, phone, matricule 
                FROM users 
                WHERE role = 'agent'
                ORDER BY name ASC
            ");
            $stmt->execute();
            
            $agents = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Formatage des données pour l'affichage
            foreach ($agents as &$agent) {
                $agent['phone'] = $agent['phone'] ?? 'Non renseigné';
                $agent['matricule'] = $agent['matricule'] ?? 'Non renseigné';
                $agent['email'] = $agent['email'] ?? 'Non renseigné';
            }
            
            return [
                'success' => true,
                'users' => $agents,
                'message' => empty($agents) ? 'Aucun agent disponible pour le moment' : null
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur lors de la récupération des agents: ' . $e->getMessage()
            ];
        }
    }

    // Obtenir un agent spécifique (vérification du rôle)
    public function getAgent($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, name, email, phone, matricule 
                FROM users 
                WHERE id = ? AND role = 'agent'
                LIMIT 1
            ");
            $stmt->execute([$id]);
            
            $agent = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$agent) {
                return [
                    'success' => false,
                    'message' => 'Agent non trouvé ou non autorisé'
                ];
            }
            
            // Gestion des valeurs nulles
            $agent['phone'] = $agent['phone'] ?? 'Non renseigné';
            $agent['matricule'] = $agent['matricule'] ?? 'Non renseigné';
            
            return [
                'success' => true,
                'user' => $agent
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur de base de données: ' . $e->getMessage()
            ];
        }
    }

    // Mettre à jour un agent
    public function updateAgent($id, $data) {
        try {
            // Vérifier d'abord que l'utilisateur est bien un agent
            $checkStmt = $this->db->prepare("SELECT id FROM users WHERE id = ? AND role = 'agent'");
            $checkStmt->execute([$id]);
            
            if (!$checkStmt->fetch()) {
                return [
                    'success' => false,
                    'message' => 'Agent non trouvé ou non autorisé'
                ];
            }

            $stmt = $this->db->prepare("
                UPDATE users 
                SET name = ?, email = ?, phone = ?, matricule = ?
                WHERE id = ?
            ");
            
            $success = $stmt->execute([
                $data['name'],
                $data['email'],
                !empty($data['phone']) ? $data['phone'] : null,
                !empty($data['matricule']) ? $data['matricule'] : null,
                $id
            ]);

            return [
                'success' => $success,
                'message' => $success ? 'Agent mis à jour avec succès' : 'Aucune modification effectuée'
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ];
        }
    }

    // Supprimer un agent (avec vérification des demandes en cours)
    public function deleteAgent($id) {
        try {
            $this->db->beginTransaction();
            
            // 1. Vérifier que c'est bien un agent
            $checkStmt = $this->db->prepare("SELECT id FROM users WHERE id = ? AND role = 'agent'");
            $checkStmt->execute([$id]);
            
            if (!$checkStmt->fetch()) {
                $this->db->rollBack();
                return [
                    'success' => false,
                    'message' => 'Agent non trouvé ou non autorisé'
                ];
            }
            
            // 2. Vérifier les demandes en cours
            $demandeStmt = $this->db->prepare("
                SELECT COUNT(*) as count 
                FROM demandes_modification 
                WHERE agent_id = ? AND statut = 'en_attente'
            ");
            $demandeStmt->execute([$id]);
            $result = $demandeStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result['count'] > 0) {
                $this->db->rollBack();
                return [
                    'success' => false,
                    'message' => 'Impossible de supprimer: cet agent a des demandes en attente'
                ];
            }
            
            // 3. Supprimer l'agent
            $deleteStmt = $this->db->prepare("DELETE FROM users WHERE id = ?");
            $success = $deleteStmt->execute([$id]);
            
            $this->db->commit();
            
            return [
                'success' => $success,
                'message' => $success ? 'Agent supprimé avec succès' : 'Échec de la suppression'
            ];
        } catch (PDOException $e) {
            $this->db->rollBack();
            return [
                'success' => false,
                'message' => 'Erreur de base de données: ' . $e->getMessage()
            ];
        }
    }

    // Lister les demandes de modification
    public function listRequests($status = null) {
        try {
            $where = $status ? "WHERE d.statut = :status" : "";
            $query = "
                SELECT d.*, 
                       u.name as nom_agent,
                       p.nom as nom_parcelle
                FROM demandes_modification d
                JOIN users u ON d.agent_id = u.id
                LEFT JOIN parcelles p ON d.parcelle_id = p.id
                $where
                ORDER BY d.created_at DESC
            ";
            
            $stmt = $this->db->prepare($query);
            if ($status) {
                $stmt->bindParam(':status', $status);
            }
            $stmt->execute();
            
            $demandes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Formatage des dates pour l'affichage
            foreach ($demandes as &$demande) {
                $demande['created_at'] = date('d/m/Y H:i', strtotime($demande['created_at']));
                $demande['nom_parcelle'] = $demande['nom_parcelle'] ?? 'Parcelle #'.$demande['parcelle_id'];
            }
            
            return $demandes;
        } catch (PDOException $e) {
            error_log("Erreur listRequests: " . $e->getMessage());
            return [];
        }
    }

    // Traiter une demande (approuver/rejeter)
    public function processRequest($demandeId, $action, $adminId) {
        try {
            $this->db->beginTransaction();
            
            // 1. Vérifier que la demande est en attente
            $stmt = $this->db->prepare("
                SELECT statut, parcelle_id, agent_id 
                FROM demandes_modification 
                WHERE id = ? 
                FOR UPDATE
            ");
            $stmt->execute([$demandeId]);
            $demande = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$demande) {
                $this->db->rollBack();
                return [
                    'success' => false,
                    'message' => 'Demande non trouvée'
                ];
            }
            
            if ($demande['statut'] !== 'en_attente') {
                $this->db->rollBack();
                return [
                    'success' => false,
                    'message' => 'Cette demande a déjà été traitée'
                ];
            }
            
            // 2. Déterminer le nouveau statut
            $newStatus = ($action === 'approve') ? 'approuvee' : 'rejetee';
            
            // 3. Mettre à jour la demande
            $updateStmt = $this->db->prepare("
                UPDATE demandes_modification 
                SET statut = ?, processed_at = NOW(), processed_by = ?
                WHERE id = ?
            ");
            $updateStmt->execute([$newStatus, $adminId, $demandeId]);
            
            // 4. Si approuvée, créer une autorisation
            if ($action === 'approve') {
                $authStmt = $this->db->prepare("
                    INSERT INTO autorisations (demande_id, validee_par, date_validation)
                    VALUES (?, ?, NOW())
                ");
                $authStmt->execute([$demandeId, $adminId]);
            }
            
            $this->db->commit();
            
            return [
                'success' => true,
                'message' => "Demande $newStatus avec succès"
            ];
        } catch (PDOException $e) {
            $this->db->rollBack();
            return [
                'success' => false,
                'message' => 'Erreur lors du traitement: ' . $e->getMessage()
            ];
        }
    }

    // Vérifier le statut d'une demande pour une parcelle
    public function checkRequestStatus($parcelleId) {
        try {
            $stmt = $this->db->prepare("
                SELECT statut 
                FROM demandes_modification 
                WHERE parcelle_id = ? 
                ORDER BY created_at DESC 
                LIMIT 1
            ");
            $stmt->execute([$parcelleId]);
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'status' => $result['statut'] ?? null
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur de vérification: ' . $e->getMessage()
            ];
        }
    }
}

// Routeur principal
$action = $_GET['action'] ?? '';
$auth = new AuthController();

try {
    switch ($action) {
        case 'create_user':
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($auth->createUser($data));
            break;
            
        case 'list_agents':
            $response = $auth->listAgents();
            echo json_encode($response);
            break;
            
        case 'get_agent':
            $id = $_GET['id'] ?? 0;
            echo json_encode($auth->getAgent($id));
            break;
            
        case 'update_agent':
            $id = $_GET['id'] ?? 0;
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($auth->updateAgent($id, $data));
            break;
            
        case 'delete_agent':
            $id = $_GET['id'] ?? 0;
            echo json_encode($auth->deleteAgent($id));
            break;
            
        case 'list_requests':
            $status = $_GET['status'] ?? null;
            echo json_encode($auth->listRequests($status));
            break;
            
        case 'process_request':
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($auth->processRequest(
                $data['demandeId'],
                $data['action'],
                $data['adminId']
            ));
            break;
            
        case 'check_request_status':
            $parcelleId = $_GET['parcelle_id'] ?? 0;
            echo json_encode($auth->checkRequestStatus($parcelleId));
            break;
            
        default:
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Action non valide'
            ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erreur serveur: ' . $e->getMessage()
    ]);
}
?>