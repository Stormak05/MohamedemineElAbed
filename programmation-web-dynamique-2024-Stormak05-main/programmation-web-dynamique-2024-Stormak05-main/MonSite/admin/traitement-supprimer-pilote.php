<?php
include "../basededonnees.php";

$titre = "Panneau d'administration";
require 'header.php';

$id = filter_var($_POST['id_pilote'], FILTER_SANITIZE_NUMBER_INT);

$SQL_SUPPRIMER_PILOTE = "DELETE FROM `formule1` WHERE `id_pilote` = :$id";

$requeteSupprimerPilote = $basededonnees->prepare($SQL_SUPPRIMER_PILOTE);
$requeteSupprimerPilote->bindParam(':id_pilote', $id['id_pilote'], PDO::PARAM_INT);
$reussiteSupprimer = $requeteSupprimerPilote->execute();

if ($reussiteSupprimer) {
    ?>
    <div class="container">
        Votre pilote a été supprimer à la base de données.
    </div>
    <?php
} else {
    echo "Votre suppression a échoué";
}

require "../footer.php";
?>