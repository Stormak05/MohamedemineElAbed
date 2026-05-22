<?php
if (isset($_POST['imageok'])) {
    $dossierCible = "../images/";
    $image = $_FILES['image']['name'];
    $fichierCible = $dossierCible . basename($image);

    if (preg_match("#png|jpg|jpeg|gif|svg|avif#", $_FILES['image']['type'])) {
        move_uploaded_file($image, $fichierCible);
        echo 'image envoyée';

        if ($_FILES['image']['size'] > 500000) {
            echo "L'image est trop volumineuse";
        } else if (file_exists($fichierCible)) {
            echo "L'image existe déjà";
        } else {
            move_uploaded_file($image, $fichierCible);
        }

    } else {
        echo "le format de l'image n'est pas valide";
    }

}
