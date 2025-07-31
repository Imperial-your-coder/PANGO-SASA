<?php
ob_start();

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require 'db_connection.php';

if (!$pdo) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]));
}

try {
    $data = json_decode($_POST['data'], true);
    
    // Commencer une transaction
    $pdo->beginTransaction();
    
    // 1. Gérer le propriétaire si la parcelle est occupée
    $proprietaire_id = null;
    if ($data['statut'] === 'occupee' && !empty($data['proprietaire_nom'])) {
        // Vérifier si le propriétaire existe déjà
        $stmt = $pdo->prepare("SELECT id FROM proprietaires WHERE nom = ?");
        $stmt->execute([$data['proprietaire_nom']]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            $proprietaire_id = $existing['id'];
        } else {
            // Créer un nouveau propriétaire
            $stmt = $pdo->prepare("
                INSERT INTO proprietaires (nom, phone, created_at) 
                VALUES (?, ?, NOW())
            ");
            $stmt->execute([
                $data['proprietaire_nom'],
                $data['proprietaire_phone']
            ]);
            $proprietaire_id = $pdo->lastInsertId();
        }
    }
    
    // 2. Gérer l'upload de la photo
    $photoPath = null;
    if (!empty($_FILES['photo'])) {
        $uploadDir = 'uploads/parcelles/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        $extension = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('parcel_') . '.' . $extension;
        $targetPath = $uploadDir . $filename;
        
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $targetPath)) {
            $photoPath = $targetPath;
        }
    }
    
    // 3. Insérer la parcelle
    $stmt = $pdo->prepare("
        INSERT INTO parcelles (
            nom, 
            statut, 
            surface, 
            coordonnees, 
            proprietaire_id, 
            date_acquisition,
            photo,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    
    $stmt->execute([
        $data['nom'],
        $data['statut'],
        $data['surface'],
        $data['coordonnees'],
        $proprietaire_id,
        $data['date_acquisition'] ?? null,
        $photoPath
    ]);
    
    $parcelle_id = $pdo->lastInsertId();
    
    // Valider la transaction
    $pdo->commit();
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'id' => $parcelle_id,
        'message' => 'Parcelle enregistrée avec succès'
    ]);
    
} catch (PDOException $e) {
    $pdo->rollBack();
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>