<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once './db_connection.php';

// Vérifier que c'est bien une requête POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée']);
    exit;
}

try {
    // Récupérer les données JSON
    $data = json_decode($_POST['data'], true);
    
    // Validation
    if (json_last_error() !== JSON_ERROR_NONE || !$data) {
        throw new Exception('Données JSON invalides');
    }

    // Valider les données requises
    $required = ['name', 'status', 'area', 'coordinates'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Le champ $field est requis");
        }
    }

    // Commencer une transaction
    $pdo->beginTransaction();

    // Insérer les données de base
    $stmt = $pdo->prepare("INSERT INTO parcelles 
        (name, status, area, coordinates, owner, phone, purchase_date) 
        VALUES (:name, :status, :area, :coordinates, :owner, :phone, :purchase_date)");
    
    $coordinates = json_encode($data['coordinates']);
    
    $stmt->execute([
        ':name' => $data['name'],
        ':status' => $data['status'],
        ':area' => $data['area'],
        ':coordinates' => $coordinates,
        ':owner' => $data['owner'] ?? null,
        ':phone' => $data['phone'] ?? null,
        ':purchase_date' => $data['purchase_date'] ?? null
    ]);

    $parcelId = $pdo->lastInsertId();

    // Gérer l'upload de l'image
    $photoPath = null;
    if (!empty($_FILES['photo'])) {
        $uploadDir = '../uploads/' . $parcelId . '/';
        
        // Créer le répertoire s'il n'existe pas
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Générer un nom de fichier unique
        $extension = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $filename = uniqid() . '.' . $extension;
        $targetPath = $uploadDir . $filename;

        // Déplacer le fichier uploadé
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $targetPath)) {
            $photoPath = '../uploads/' . $parcelId . '/' . $filename;
            
            // Mettre à jour le chemin de la photo dans la base de données
            $pdo->prepare("UPDATE parcelles SET photo = ? WHERE id = ?")
                ->execute([$photoPath, $parcelId]);
        }
    }

    // Valider la transaction
    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'id' => $parcelId,
        'photoPath' => $photoPath,
        'message' => 'Parcelle enregistrée avec succès'
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Erreur: ' . $e->getMessage()
    ]);
}
?>