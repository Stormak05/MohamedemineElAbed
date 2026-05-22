<?php

include "../basededonnees.php";

$MESSAGE_SQL_LISTE_PILOTE = "SELECT `id_pilote`, `image`, `nom`, `numero`, `ecurie` FROM `formule1`";
$requeteListePilote = $basededonnees->prepare($MESSAGE_SQL_LISTE_PILOTE);
$requeteListePilote->execute();
$listePilote = $requeteListePilote->fetchAll();

$titre = "Panneau d'administration";
require 'header.php';
?>

<h1>Panneau d'administration</h1>
<a href="ajouter-pilote.php" class="bouton-ajouter">Ajouter</a>
        <div id="liste-pilote"></div>
                <?php
foreach ($listePilote as $formule1) {
    ?>

<div class="pilote">
 <div class="card mb-3" style="max-width: 880px;">
  <div class="row g-0">
    <div class="col-md-4">
    <img src="../images/<?=$formule1['image']?>" class="images" alt="image">
    </div>

    <div class="col-md-8">

      <div class="card-body">

      <p class="nom"><?=$formule1['nom']?></p>
      <a href="modifier-pilote.php?formule1=<?=$formule1['id_pilote']?>" class="bouton-modifier">Modifier</a>
      <a href="supprimer-pilote.php?formule1=<?=$formule1['id_pilote']?>" class="bouton-supprimer">Supprimer</a>

      </div>

    </div>
  </div>
 </div>
</div>

                    <?php
}
?>


<?php
require '../footer.php';
?>
