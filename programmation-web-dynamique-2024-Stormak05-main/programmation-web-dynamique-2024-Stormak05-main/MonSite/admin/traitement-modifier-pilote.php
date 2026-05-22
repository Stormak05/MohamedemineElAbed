<?php
include "../basededonnees.php";
require "traitement-image.php";

$titre = "Panneau d'administration";
require 'header.php';

$FILTRES_PILOTE = array(
    'id_pilote' => FILTER_SANITIZE_NUMBER_INT,
    'nom' => FILTER_SANITIZE_ADD_SLASHES,
    'age' => FILTER_SANITIZE_ADD_SLASHES,
    'numero' => FILTER_SANITIZE_ADD_SLASHES,
    'ecurie' => FILTER_SANITIZE_ADD_SLASHES,
    'equipier' => FILTER_SANITIZE_ADD_SLASHES,
    'champion' => FILTER_SANITIZE_ADD_SLASHES,
    'description' => FILTER_SANITIZE_ADD_SLASHES,
    'image' => FILTER_SANITIZE_SPECIAL_CHARS,
);

$pilote = filter_input_array(INPUT_POST, $FILTRES_PILOTE);

$SQL_MODIFIER_PILOTE = "UPDATE `formule1` SET `nom`='$nom',`age`='$age',`numero`='$numero',`ecurie`='$ecurie',`equipier`='$equipier',`champion`='$champion',`description`='$description', `id_pilote`= $id_pilote, `image` = $image WHERE `id_pilote` = :$id_pilote";

$requeteModifierPilote = $basededonnees->prepare($SQL_MODIFIER_PILOTE);

$requeteModifierPilote->bindParam(':nom', $nom['nom'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':age', $age['age'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':numero', $numero['numero'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':ecurie', $ecurie['ecurie'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':equipier', $equipier['equipier'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':champion', $champion['champion'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':description', $description['description'] ,PDO::PARAM_STR);
$requeteModifierPilote->bindParam(':image', $image['image'] ,PDO::PARAM_STR);

$reussiteModification = $requeteModifierPilote->execute();

if ($reussiteModification) {
    ?>
    <div class="container">
        Votre pilote a été modifier à la base de données.
    </div>
    <?php
} else {
    echo "Votre modification a échoué";
}

require "../footer.php";
?>