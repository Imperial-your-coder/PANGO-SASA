<?php
// Assurez-vous qu'aucun output n'est envoyé avant les headers
ob_start();

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *"); // Important pour les requêtes fetch

// Vérifiez que le fichier de connexion existe et est valide
$dbFile = 'db_connection.php';
if (!file_exists($dbFile)) {
    die(json_encode([
        'success' => false,
        'message' => 'Database configuration file missing'
    ]));
}

require $dbFile;

// Vérifiez la connexion à la base de données
if (!$pdo) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]));
}

try {
    $stmt = $pdo->query("SELECT id, name, status, area, coordinates, owner, phone, purchase_date FROM parcelles");
    
    if (!$stmt) {
        throw new PDOException($pdo->errorInfo()[2]);
    }
    
    $parcelles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($parcelles as &$parcelle) {
        // Validez que coordinates est un JSON valide
        if (!empty($parcelle['coordinates'])) {
            $decoded = json_decode($parcelle['coordinates'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $parcelle['coordinates'] = $decoded;
            } else {
                $parcelle['coordinates'] = [];
            }
        } else {
            $parcelle['coordinates'] = [];
        }
    }
    
    // Nettoyage du buffer avant output
    ob_end_clean();
    echo json_encode($parcelles);
    
} catch (PDOException $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>