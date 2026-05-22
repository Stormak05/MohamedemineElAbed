<?php
$titre = "Panneau d'administration";
require 'header.php';
?>
<h1>Panneau d'administration</h1>

<section id="contenu">
    <h2>Ajouter un Pilote</h2>
    <div class="card w-75 col-md-2 offset-md-2 border-primary ">
  <div class="card-body">
  <form action="traitement-ajouter-pilote.php" method="post" enctype="multipart/form-data">
  <div class="mb-3">
    <label for="nom" class="form-label">Nom</label>
    <input type="text" class="form-control" name='nom' id="nom">
  </div>

  <div class="mb-3">
    <label for="age" class="form-label">Age</label>
    <input type="text" class="form-control" name='age' id="age">
  </div>

  <div class="mb-3">
    <label for="numero" class="form-label">Numéro</label>
    <input type="text" class="form-control" name='numero' id="numero">
  </div>

  <div class="mb-3">
    <label for="ecurie" class="form-label">Écurie</label>
    <input type="text" class="form-control" name='ecurie' id="ecurie">
  </div>

  <div class="mb-3">
    <label for="equipier" class="form-label">Équipier</label>
    <input type="text" class="form-control" name='equipier' id="equipier">
  </div>

  <div class="mb-3">
    <label for="champion" class="form-label">Champion</label>
    <input type="text" class="form-control" name='champion' id="champion">
  </div>

  <div class="mb-3">
    <label for="description" class="form-label">Description</label>
    <input type="text" class="form-control" name='description' id="description">
  </div>
  </form>
  <form action="traitement-image.php" method="post" enctype="multipart/form-data">
  <div class="mb-3">

    <div>
            <label for="image">Transfert d'image : </label>
        <input type="file" name="image" id="image" >
    </div>
  </div>

  <button type="submit" name="imageok" value="Enregistrer" class="btn btn-primary">Enregistrer</button>
</form>
  </div>
</div>
</section>

<?php
require "../footer.php";
?>
