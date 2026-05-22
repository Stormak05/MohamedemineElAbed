<?php

include "basededonnees.php";

$resultats = [];
$nomRecherche = filter_var($_GET['recherche-nom'], FILTER_SANITIZE_SPECIAL_CHARS);
$numeroRecherche = filter_var($_GET['recherche-numero'], FILTER_SANITIZE_SPECIAL_CHARS);
$ecurieRecherche = filter_var($_GET['recherche-ecurie'], FILTER_SANITIZE_SPECIAL_CHARS);

if (!empty($nomRecherche) || !empty($numeroRecherche) || !empty($ecurieRecherche)) {
    $SQL_RECHERCHE_AVANCEE = "SELECT * FROM formule1 WHERE 1 = 1";

    if (!empty($nomRecherche)) {
        $SQL_RECHERCHE_AVANCEE = $SQL_RECHERCHE_AVANCEE . " AND LOWER(nom) LIKE LOWER('%$nomRecherche%')";
    }

    if (!empty($numeroRecherche)) {
        $SQL_RECHERCHE_AVANCEE = $SQL_RECHERCHE_AVANCEE . " AND LOWER(numero) LIKE LOWER('%$numeroRecherche%')";
    }

    if (!empty($ecurieRecherche)) {
        $SQL_RECHERCHE_AVANCEE = $SQL_RECHERCHE_AVANCEE . " AND LOWER(ecurie) LIKE LOWER('%$ecurieRecherche%')";
    }

    $requeteRecherche = $basededonnees->prepare($SQL_RECHERCHE_AVANCEE);
    $requeteRecherche->execute();
    $resultats = $requeteRecherche->fetchAll();
}

$titre = "Recherche avancée";
require 'header.php';

?>
    <h1>Formule 1</h1>
    <?php
if (count($resultats) != 0) {
    ?>
        <h2><?="Nombre de résultats : " . count($resultats)?></h2>
        <?php
} else {
    ?>
    <h2>Résultat de la rechrche : 0.</h2>
    <?php
}
?>
        <div id="liste-pilote"></div>
                <?php
foreach ($resultats as $resultat) {
    ?>
                    <div class="pilote">
                        <div class="images"><img src="images/<?=$resultat['image']?>" alt="image"></div>
                        <p class="nom">Nom : <?=$resultat['nom']?></p>
                        <p class="age">Âge : <?=$resultat['age']?></p>
                        <p class="numero">Numéro de course : <?=$resultat['numero']?></p>
                        <p class="ecurie">Écurie : <?=$resultat['ecurie']?></p>
                        <p class="equipier">Équipier : <?=$resultat['equipier']?></p>
                    </div>

                    <?php
}
?>

            </div>
<?php
require 'footer.php';
?>
