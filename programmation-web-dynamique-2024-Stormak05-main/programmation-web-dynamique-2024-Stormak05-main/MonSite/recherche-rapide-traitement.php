<?php

include "basededonnees.php";
$nomRecherche = filter_var($_GET['recherche-nom'], FILTER_SANITIZE_SPECIAL_CHARS);
$numeroRecherche = filter_var($_GET['recherche-numero'], FILTER_SANITIZE_SPECIAL_CHARS);
$ecurieRecherche = filter_var($_GET['recherche-ecurie'], FILTER_SANITIZE_SPECIAL_CHARS);
$resultats = [];

if (!empty($_GET['mot'])) {
    $mot = filter_var($_GET['mot'], FILTER_SANITIZE_SPECIAL_CHARS);
    $SQL_RECHERCHE_RAPIDE = "SELECT * FROM formule1 WHERE nom LIKE '%$mot%' OR equipier LIKE'%$mot%' OR ecurie LIKE'%$mot%' OR numero LIKE'%$mot%' OR champion LIKE '%$mot%'";

    $requeteRechercheRapide = $basededonnees->prepare($SQL_RECHERCHE_RAPIDE);

    $requeteRechercheRapide->execute();
    $resultats = $requeteRechercheRapide->fetchAll();
}

$titre = "Recherche";
require 'header.php';

?>
    <h1>Formule 1</h1>
    <?php
if (count($resultats) != 0) {
    ?>
        <h2><?="Le mot : " . $mot . " a été trouvé " . count($resultats) . " fois."?></h2>
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
                        <span class="ecurie">Écurie : <?=$resultat['ecurie']?></span>
                        <h3 class="equipier">Équipier : <?=$resultat['equipier']?></h3>
                    </div>

                    <?php
}
?>

            </div>
<?php
require 'footer.php';
?>