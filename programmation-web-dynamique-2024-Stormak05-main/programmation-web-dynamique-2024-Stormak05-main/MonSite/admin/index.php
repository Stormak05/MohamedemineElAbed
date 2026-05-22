<?php
require "../configuration.php";
require CHEMIN_ACCESSEUR. "PiloteDAO.php";
require CHEMIN_ACCESSEUR. "ClicDAO.php";

$statsCategorie = PiloteDAO::listerCategorie();
$listeParChampion = PiloteDAO::listeParChampion();
$listeParNumero = PiloteDAO::listeParNumero();

$statsJour = ClicDAO::listerStatsParJour();
$statsLangue = ClicDAO::listerStatsParLangue();

$jourDeLaSemaine = array("Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi");

$imageAleatoire = PiloteDAO::afficherImageAleatoire();
$titre = "Panneau Admin";
require 'header.php';
?>

<div class="container">

<h2>Dashbord</h2>

<section id="dashboard">
    <div class="row">
    <div class="col-sm-4 mb-3 mb-sm-0">
    <div class="card">
      <div class="card-body">
      <h3 class="nom-aleatoire"><?=$imageAleatoire['nom']?></h3>
      <img src="../images/<?=$imageAleatoire['image']?>" alt="image1" id="image1" />
        <p class="card-text">Numéro : <?=$imageAleatoire['numero']?></p>
        <p class="card-text"><?=$imageAleatoire['champion']?> fois champion du monde.</p>
        <a href="liste-admin.php" class="card-link">Gestion des pilotes</a>
      </div>
    </div>
  </div>

  <div class="col-sm-4 mb-5 mb-sm-0">
    <div class="card">
      <div class="card-body">
      <div class="stats">
    <div class="liste-item">
        <table>
            <caption>Tableau statistiques des pilotes</caption>
            <tr class="">
                <th>Nom</th>
                <th>Numero</th>
                <th>Titres</th>
                <th>Moyenne des titres</th>
                <th>Minimum des titres</th>
            </tr>
            <?php
            foreach($statsCategorie as $categorie) {
                ?>
                <tr class="pair">
                    <td><?= $categorie['nom']?></td>
                    <td><?= $categorie['numero']?></td>
                    <td><?= $categorie['maxchampion'] . "titres"?></td>
                    <td><?= $categorie['moychampion']?></td>
                    <td><?= $categorie['minchampion']?></td>
                </tr>
                <?php
            }
            ?>
        </table>
    </div>
</div>
        <a href="contenu-stats.php" class="card-link">Statistiques pilotes</a>
      </div>
    </div>
  </div>

  <div class="col-sm-4 mb-3 mb-sm-0">
    <div class="card">
      <div class="card-body">
      <div class="liste-item">
        <table>
            <caption>Tableau statistique par jour de la semaine</caption>
            <tr class="impair">
                <th>Jour</th>
                <th>Clics</th>
                <th>Visites</th>
            </tr>
            <?php
            foreach($statsJour as $jourEnregistre) {
                ?>
                <tr class="pair">
                    <td><?= $jourDeLaSemaine[$jourEnregistre['jour'] - 1]?></td>
                    <td><?= $jourEnregistre['clics']?></td>
                    <td><?= $jourEnregistre['visites']?></td>
                </tr>
                <?php
            }
            ?>
        </table>
        <table>
            <caption>Calcul de l'écart-type</caption>
            <tr>
                <th>Écart-type</th>
            </tr>
            <tr>
                <td><?= $imageAleatoire['ecart_type']?></td>
            </tr>
        </table>
    </div>
        <a href="visites-stats.php" class="card-link">Statistiques visites</a>
      </div>
    </div>
  </div>

  <div class="col-sm-4 mb-3 mb-sm-0">
    <div class="card">
      <div class="card-body">
      <h3 class="nom-aleatoire">GRAPHIQUE</h3>
        <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
        <a href="liste-admin.php" class="card-link">Gestion des pilotes</a>
      </div>
    </div>
  </div>

  <div class="col-sm-4 mb-3 mb-sm-0">
    <div class="card">
      <div class="card-body">
      <h3 class="nom-aleatoire">Pensée du jour</h3>
      <img src="../images/charles_leclerc.avif" alt="image2">
        <p class="card-text">"Pour grandir il faut comprendre et admettre ses erreurs, 
            c'est une approche qui marche pour moi, ce n'est pas forcément la même pour tout le monde." 
            a dit Charles Leclerc</p>
      </div>
    </div>
  </div>

  <div class="col-sm-4 mb-3 mb-sm-0">
    <div class="card">
      <div class="card-body">
        <h3>GRAPHIQUE</h3>
        <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
        <a href="liste-admin.php" class="card-link">Gestion des pilotes</a>
      </div>
    </div>
  </div>
    </div>
    

</section>
    
</div>

<?php
require '../footer.php';
?>