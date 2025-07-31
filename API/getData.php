<?php
ob_start();

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$dbFile = 'db_connection.php';
if (!file_exists($dbFile)) {
    die(json_encode([
        'success' => false,
        'message' => 'Database configuration file missing'
    ]));
}

require $dbFile;

if (!$pdo) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]));
}

try {
    // Requête modifiée pour correspondre à la nouvelle structure
    $stmt = $pdo->query("
        SELECT 
            p.id, 
            p.nom, 
            p.statut, 
            p.surface, 
            p.coordonnees, 
            p.proprietaire_id, 
            pr.nom AS proprietaire_nom,
            pr.phone AS proprietaire_phone,
            p.date_acquisition,
            p.photo
        FROM parcelles p
        LEFT JOIN proprietaires pr ON p.proprietaire_id = pr.id
    ");
    
    if (!$stmt) {
        throw new PDOException($pdo->errorInfo()[2]);
    }
    
    $parcelles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($parcelles as &$parcelle) {
        // Traitement des coordonnées JSON
        if (!empty($parcelle['coordonnees'])) {
            $decoded = json_decode($parcelle['coordonnees'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $parcelle['coordonnees'] = $decoded;
            } else {
                $parcelle['coordonnees'] = [];
            }
        } else {
            $parcelle['coordonnees'] = [];
        }
        
        // Formatage des données pour le frontend
        $parcelle['proprietaire'] = $parcelle['proprietaire_nom'] ?? null;
        $parcelle['phone'] = $parcelle['proprietaire_phone'] ?? null;
        $parcelle['purchase_date'] = $parcelle['date_acquisition'] ?? null;
    }
    
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