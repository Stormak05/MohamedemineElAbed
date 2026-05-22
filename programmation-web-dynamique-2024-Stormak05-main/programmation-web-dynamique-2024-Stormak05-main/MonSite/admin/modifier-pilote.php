<?php
include "../basededonnees.php";

$titre = "Panneau d'administration";
require 'header.php';

$idPilote = filter_var($_GET['formule1'], FILTER_SANITIZE_SPECIAL_CHARS);

$SQL_PILOTE = "SELECT * FROM `formule1` WHERE `id_pilote` = :idPilote";
$requetePilote = $basededonnees->prepare($SQL_PILOTE);
$requetePilote->bindParam(':idPilote', $idPilote, PDO::PARAM_INT);
$requetePilote->execute();
$formule1 = $requetePilote->fetch();
?>

<h1>Panneau d'administration</h1>

<section id="contenu">
    <h2>Modifier un Pilote</h2>
    <div class="card w-75 col-md-2 offset-md-2 border-primary ">
  <div class="card-body">
  <form action="traitement-modifier-pilote.php" method="post" enctype="multipart/form-data">
  <div class="mb-3">
    <label for="nom" class="form-label">Nom</label>
    <input type="text" class="form-control" name='nom' id="nom"  value="<?=$formule1['nom']?>">
  </div>

  <div class="mb-3">
    <label for="age" class="form-label">Age</label>
    <input type="text" class="form-control" name='age' id="age"  value="<?=$formule1['age']?>">
  </div>

  <div class="mb-3">
    <label for="numero" class="form-label">Numéro</label>
    <input type="text" class="form-control" name='numero' id="numero"  value="<?=$formule1['numero']?>">
  </div>

  <div class="mb-3">
    <label for="ecurie" class="form-label">Écurie</label>
    <input type="text" class="form-control" name='ecurie' id="ecurie"  value="<?=$formule1['ecurie']?>">
  </div>

  <div class="mb-3">
    <label for="equipier" class="form-label">Équipier</label>
    <input type="text" class="form-control" name='equipier' id="equipier"  value="<?=$formule1['equipier']?>">
  </div>

  <div class="mb-3">
    <label for="champion" class="form-label">Champion du monde</label>
    <input type="text" class="form-control" name='champion' id="champion"  value="<?=$formule1['champion']?>">
  </div>

  <div class="mb-3">
    <label for="description" class="form-label">Description</label>
    <input type="text" class="form-control" name='description' id="description"  value="<?=$formule1['description']?>">
  </div>
</form>
<form action="traitement-image.php">
  <div class="mb-3">
  <label for="image" class="form-label">Image</label>
    <input type="file" class="form-control" name='image' id="image">
  </div>
  <button type="submit" name="imageok" value="Enregistrer" class="btn btn-primary">Enregistrer</button>
  <input type="hidden" name="id_pilote">
</form>
  </div>
</div>


</section>

<?php
require "../footer.php";
?>
