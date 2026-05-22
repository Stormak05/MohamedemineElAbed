<?php
require "configuration.php";
require CHEMIN_ACCESSEUR . "ClicDAO.php";
ClicDAO::enregistrerVisite($_SERVER);
require CHEMIN_ACCESSEUR . "PiloteDAO.php";


$listePilote = PiloteDAO::lirePilote($id_pilote);

$titre = $formule1['nom'];
require 'header.php';

?>
<h1>Pilote : <?=$formule1['nom']?></h1>
<section id="contenu">
<div class="pilote">
<div class="card mb-3" style="max-width: 880px;">
  <div class="row g-0">
    <div class="col-md-4">
    <img src="images/<?=$formule1['image']?>" class="images" alt="image">
    </div>
    <div class="col-md-8">
      <div class="card-body">
      <p class="nom">Nom complet : <?=$formule1['nom']?></p>
      <p class="age">Âge : <?=$formule1['age']?> ans</p>
      <p class="numero">Numéro de course : <?=$formule1['numero']?></p>
      <p class="ecurie">Écurie : <?=$formule1['ecurie']?></p>
      <p class="equipier">Équipier : <?=$formule1['equipier']?></p>
      <p class="champion">Nombre de fois champion du monde : <?=$formule1['champion']?></p>
      <span class="description">Description : <?=$formule1['description']?></span>
      </div>
    </div>
  </div>
</div>
</div>
</section>

<?php
require 'footer.php';
?>
