<?php
require "configuration.php";
require_once CHEMIN_ACCESSEUR . "ClicDAO.php";
ClicDAO::enregistrerVisite($_SERVER);
require CHEMIN_ACCESSEUR . "PiloteDAO.php";

$listePilote = PiloteDAO::listerPilotes();



$titre = 'Pilote de formule 1';
require 'header.php';

?>

<h1>Formule 1</h1>
<h2>Liste des Pilotes</h2>
        <div id="liste-pilote"></div>
                <?php
foreach ($listePilote as $formule1) {
    ?>

<div class="pilote">
 <div class="card mb-3" style="max-width: 880px;">
  <div class="row g-0">
    <div class="col-md-4">
    <img src="images/<?=$formule1['image']?>" class="images" alt="image">
    </div>
    <div class="col-md-8">
      <div class="card-body">
      <p class="nom">Nom : <?=$formule1['nom']?></p>
      <p class="age">Âge : <?=$formule1['age']?> ans</p>
      <p class="numero">Numéro de course : <?=$formule1['numero']?></p>
      <p class="ecurie">Écurie : <?=$formule1['ecurie']?></p>
      <p class="equipier">Équipier : <?=$formule1['equipier']?></p>
      <a href="pilote.php?toto=<?=$formule1['id_pilote']?>" class="bouton">En savoir plus</a>

      </div>
    </div>
  </div>
 </div>
</div>

                    <?php
}
?>

<?php
require 'footer.php';
?>
