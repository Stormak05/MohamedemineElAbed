<?php
include "../configuration.php";
require CHEMIN_ACCESSEUR . "ClicDAO.php";
require CHEMIN_ACCESSEUR. "PiloteDAO.php";

$imageAleatoire = PiloteDAO::afficherImageAleatoire();

$statsJour = ClicDAO::listerStatsParJour();
$statsLangue = ClicDAO::listerStatsParLangue();

$jourDeLaSemaine = array("Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi");

$titre = "Panneau Admin";
require 'header.php';
?>

<div class="stats">
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
    </div>

    <div class="liste-item">
        <table>
            <caption>Tableau statistique par langues</caption>
            <tr>
                <th>Langue</th>
                <th>Clics</th>
                <th>Visites</th>
            </tr>
            <?php
            foreach($statsLangue as $langueEnregistre) {
                ?>
                <tr>
                    <td><?= $langueEnregistre['langue']?></td>
                    <td><?= $langueEnregistre['clics']?></td>
                    <td><?= $langueEnregistre['visites']?></td>
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

        <div class="chart-container2">
            <canvas id="barChart"></canvas>
        </div>
    </div>

</div>

<?php
require "../footer.php";
?>