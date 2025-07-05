<?php
header('Content-Type: application/json');
require_once 'Database.php'; // Supposé existant

class Administrateur {
    private $id;
    public $nom;
    private $password;
    public $phone;

    public function __construct($id, $nom, $password, $phone) {
        $this->id = $id;
        $this->nom = $nom;
        $this->password = $password;
        $this->phone = $phone;
    }

    public function getId() { return $this->id; }
}

class Agent {
    private $id;
    public $matricule;
    public $nom;
    public $phone;

    public function __construct($id, $matricule, $nom, $phone) {
        $this->id = $id;
        $this->matricule = $matricule;
        $this->nom = $nom;
        $this->phone = $phone;
    }

    public function getId() { return $this->id; }
}

class Parcelle {
    public $created_at;
    public $geom;
    private $id;
    public $nom;
    public $statut;

    public function __construct($id, $nom, $geom, $statut) {
        $this->id = $id;
        $this->nom = $nom;
        $this->geom = $geom;
        $this->statut = $statut;
        $this->created_at = date('Y-m-d H:i:s');
    }

    public function getId() { return $this->id; }
}

class DemandeAutorisation {
    private $date_demande;
    private $id;
    public $id_agent;
    public $id_parcelle;
    public $statut;

    public function __construct($id, $id_agent, $id_parcelle, $statut = 'en_attente') {
        $this->id = $id;
        $this->id_agent = $id_agent;
        $this->id_parcelle = $id_parcelle;
        $this->statut = $statut;
        $this->date_demande = date('Y-m-d H:i:s');
    }

    public function getId() { return $this->id; }
}

class Autorisation {
    public $date;
    private $id_demande;
    public $validee_par;

    public function __construct($id_demande, $validee_par) {
        $this->id_demande = $id_demande;
        $this->validee_par = $validee_par;
        $this->date = date('Y-m-d H:i:s');
    }
}

class AutorisationService {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function enregistrerDemande($id_agent, $id_parcelle) {
        if ($this->verifierDoublon($id_agent, $id_parcelle)) {
            return ['success' => false, 'message' => 'Demande déjà existante'];
        }

        $demande = new DemandeAutorisation(null, $id_agent, $id_parcelle);
        // Sauvegarde en base (exemple simplifié)
        $stmt = $this->db->prepare("INSERT INTO demandes (id_agent, id_parcelle, statut) VALUES (?, ?, ?)");
        $stmt->execute([$id_agent, $id_parcelle, 'en_attente']);

        return ['success' => true, 'id_demande' => $this->db->lastInsertId()];
    }

    public function validerDemande($id_demande, $id_admin, $decision) {
        $statut = ($decision === 'accept') ? 'approuvee' : 'rejetee';
        
        // Mise à jour de la demande
        $stmt = $this->db->prepare("UPDATE demandes SET statut = ? WHERE id = ?");
        $stmt->execute([$statut, $id_demande]);

        if ($decision === 'accept') {
            $autorisation = new Autorisation($id_demande, $id_admin);
            // Sauvegarde de l'autorisation
            $stmt = $this->db->prepare("INSERT INTO autorisations (id_demande, validee_par) VALUES (?, ?)");
            $stmt->execute([$id_demande, $id_admin]);
        }

        return ['success' => true];
    }

    public function verifierDoublon($id_agent, $id_parcelle) {
        $stmt = $this->db->prepare("SELECT id FROM demandes WHERE id_agent = ? AND id_parcelle = ? AND statut = 'en_attente'");
        $stmt->execute([$id_agent, $id_parcelle]);
        return $stmt->fetch() !== false;
    }

    public function getDemandesEnAttente() {
        $stmt = $this->db->prepare("
            SELECT d.*, a.nom as nom_agent, p.nom as nom_parcelle 
            FROM demandes d
            JOIN agents a ON d.id_agent = a.id
            JOIN parcelles p ON d.id_parcelle = p.id
            WHERE d.statut = 'en_attente'
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

// Initialisation
$db = new Database(); // Classe hypothétique pour la connexion DB
$service = new AutorisationService($db);

// Traitement des requêtes
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getPending') {
    echo json_encode($service->getDemandesEnAttente());
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if ($data['action'] === 'validate') {
        session_start();
        $id_admin = $_SESSION['admin_id']; // Supposé disponible après auth
        $result = $service->validerDemande($data['idDemande'], $id_admin, $data['decision']);
        echo json_encode($result);
    }
}
?>