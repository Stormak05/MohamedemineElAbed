<?php
require "../configuration.php";
require "traitement-image.php";
require CHEMIN_ACCESSEUR . "PiloteDAO.php";

$titre = "Panneau d'administration";
require 'header.php';

$FILTRES_PILOTE = array(
    'nom' => FILTER_SANITIZE_SPECIAL_CHARS,
    'age' => FILTER_SANITIZE_SPECIAL_CHARS,
    'numero' => FILTER_SANITIZE_SPECIAL_CHARS,
    'ecurie' => FILTER_SANITIZE_SPECIAL_CHARS,
    'equipier' => FILTER_SANITIZE_SPECIAL_CHARS,
    'champion' => FILTER_SANITIZE_SPECIAL_CHARS,
    'description' => FILTER_SANITIZE_SPECIAL_CHARS,
    'image' => FILTER_SANITIZE_SPECIAL_CHARS,
);

$pilote = filter_input_array(INPUT_POST, $FILTRES_PILOTE);

$imageOrigine = $_POST['image'];

$image = $imageOrigine;
if (empty($image)) {
    $image = $imageOrigine;
}

$SQL_AJOUTER_PILOTE = "INSERT INTO `formule1`(`nom`, `age`, `numero`, `ecurie`, `equipier`, `champion`, `description`) VALUES (:$nom ,:$age ,:$numero,:$ecurie,:$equipier,:$champion,:$description)";

$reussiteAjout = PiloteDAO::ajouterPilote($pilote);

if ($reussiteAjout) {
    ?>
    <div class="container">
        Votre pilote a été ajouter à la base de données.
    </div>
    <?php
} else {
    echo "Votre envoie a échoué";
}

require "../footer.php";
?>