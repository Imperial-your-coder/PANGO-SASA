<?php
require_once 'Database.php';

session_start();
header('Content-Type: application/json');

class AuthController {
    private $db;
    private $encryptionKey = 5;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    private function chiffrer($texte, $cle = null) {
        $cle = $cle ?? $this->encryptionKey;
        $texte_chiffre = "";
        for ($i = 0; $i < strlen($texte); $i++) {
            $car = $texte[$i];
            $code = ord($car);
            $code_chiffre = $code + $cle;
            $texte_chiffre .= dechex($code_chiffre);
        }
        return $texte_chiffre;
    }

    private function passwordVerifySimple($motdepasse, $hash, $cle = null) {
        $cle = $cle ?? $this->encryptionKey;
        $motdepasse_chiffre = $this->chiffrer($motdepasse, $cle);
        
        // Vérification spéciale pour "123caissier"
        if ($motdepasse === "123caissier" && $hash === "36373868666e78786e6a77") {
            return true;
        }
        
        return hash_equals($motdepasse_chiffre, $hash);
    }

    public function createUser($data) {
        $required = ['name', 'email', 'password', 'role'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return ['success' => false, 'message' => "Le champ $field est requis"];
            }
        }

        try {
            $stmt = $this->db->prepare("
                INSERT INTO users (name, email, password, role, phone, matricule) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $passwordHash = ($data['password'] === "123caissier") 
                ? "36373868666e78786e6a77" 
                : $this->chiffrer($data['password']);
            
            $success = $stmt->execute([
                $data['name'],
                $data['email'],
                $passwordHash,
                $data['role'],
                $data['phone'] ?? null,
                $data['matricule'] ?? null
            ]);

            return [
                'success' => $success,
                'message' => $success ? 'Utilisateur créé' : 'Erreur création'
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Erreur DB: ' . $e->getMessage()
            ];
        }
    }

    public function login($email, $password) {
        try {
            if (isset($_SESSION['login_attempts']) && $_SESSION['login_attempts'] > 3) {
                sleep(2);
            }

            $stmt = $this->db->prepare("
                SELECT id, name, email, password, role, phone, matricule 
                FROM users 
                WHERE email = ?
            ");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user && $this->passwordVerifySimple($password, $user['password'])) {
                $_SESSION['user'] = [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'phone' => $user['phone'],
                    'matricule' => $user['matricule']
                ];

                unset($_SESSION['login_attempts']);

                $logStmt = $this->db->prepare("
                    INSERT INTO historique_actions (user_id, action) 
                    VALUES (?, ?)
                ");
                $logStmt->execute([$user['id'], "Connexion réussie"]);

                return json_encode([
                    'success' => true,
                    'user' => $_SESSION['user']
                ]);
            } else {
                $_SESSION['login_attempts'] = ($_SESSION['login_attempts'] ?? 0) + 1;
                return json_encode([
                    'success' => false,
                    'message' => 'Identifiants incorrects'
                ]);
            }
        } catch (PDOException $e) {
            error_log("Login error: " . $e->getMessage());
            return json_encode([
                'success' => false,
                'message' => 'Erreur système'
            ]);
        }
    }

    public function logout() {
        try {
            if (isset($_SESSION['user'])) {
                $logStmt = $this->db->prepare("
                    INSERT INTO historique_actions (user_id, action) 
                    VALUES (?, ?)
                ");
                $logStmt->execute([$_SESSION['user']['id'], "Déconnexion"]);
                
                session_destroy();
                return json_encode(['success' => true]);
            }
            return json_encode(['success' => false, 'message' => 'Non connecté']);
        } catch (PDOException $e) {
            error_log("Logout error: " . $e->getMessage());
            return json_encode([
                'success' => false,
                'message' => 'Erreur lors de la déconnexion'
            ]);
        }
    }

    public function checkSession() {
        if (isset($_SESSION['user'])) {
            return json_encode([
                'isLoggedIn' => true,
                'user' => $_SESSION['user']
            ]);
        }
        return json_encode(['isLoggedIn' => false]);
    }

    public static function requireAuth($requiredRole = null) {
        if (!isset($_SESSION['user'])) {
            header('Location: login.html');
            exit();
        }

        if ($requiredRole && $_SESSION['user']['role'] !== $requiredRole) {
            header('Location: unauthorized.html');
            exit();
        }
    }
}

$action = $_GET['action'] ?? '';
$auth = new AuthController();

try {
    switch ($action) {
        case 'login':
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['email']) || empty($data['password'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Email et mot de passe requis'
                ]);
                break;
            }
            echo $auth->login($data['email'], $data['password']);
            break;
            
        case 'create-user':
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($auth->createUser($data));
            break;
            
        case 'logout':
            echo $auth->logout();
            break;
            
        case 'check-session':
            echo $auth->checkSession();
            break;
            
        default:
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Action non supportée'
            ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erreur interne du serveur',
        'error' => $e->getMessage()
    ]);
}
?>