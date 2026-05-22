<?php
include "../basededonnees.php";

$titre = "Panneau d'administration";
require 'header.php';

$nb = filter_var($_GET['formule1'], FILTER_SANITIZE_NUMBER_INT);

$SQL_BYE_PILOTE = "SELECT * FROM `formule1` WHERE `id_pilote` = :id_pilote";
$requetePourPilote = $basededonnees->prepare($SQL_BYE_PILOTE);
$requetePourPilote->bindParam(':id_pilote', $nb, PDO::PARAM_INT);
$requetePourPilote->execute();
$formule1 = $requetePourPilote->fetch();
?>

<h1>Panneau d'administration</h1>

<section id="contenu">
    <h2>Supprimer un Pilote</h2>

<form  action="traitement-supprimer-pilote.php">
<button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#exampleModal<?=$formule1['id_pilote']?>">
  Supprimer ce pilote
</button>


<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h1 class="modal-title fs-5" id="exampleModalLabel">Êtes-vous sûr de vouloir supprimer ce pilote ?</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        ...
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Non</button>
        <button type="button" class="btn btn-primary">Oui</button>
      </div>
    </div>
  </div>
</div>
</form>



</section>

<script>
const myModal = document.getElementById('myModal')
const myInput = document.getElementById('myInput')

myModal.addEventListener('shown.bs.modal', () => {
  myInput.focus()
})
</script>

<?php
require "../footer.php";
?>
