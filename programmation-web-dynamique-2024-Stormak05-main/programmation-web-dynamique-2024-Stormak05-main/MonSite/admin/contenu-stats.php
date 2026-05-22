<?php
include "../configuration.php";
require CHEMIN_ACCESSEUR . "PiloteDAO.php";

$statsCategorie = PiloteDAO::listerCategorie();
$listeParChampion = PiloteDAO::listeParChampion();
$listeParNumero = PiloteDAO::listeParNumero();


$titre = "Panneau Admin";
require 'header.php';
?>

<div class="stats">
    <div class="liste-item">
        <table>
            <caption>Tableau statistiques des pilotes</caption>
            <tr class="impair">
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

<div class="stats">
    <div class="chart-container">
        <canvas id="pieChart"></canvas>
    </div>

    <div class="chart-container">
        <canvas id="anneauChart"></canvas>
    </div>
</div>

<script>
    <?php
        $listerParCategorie= [];
        foreach($statsCategorie as $categorie){
            $listeParChampion[] = $categorie['numero'];
            $listeParNumero[] = $categorie['maxchampion'];
            $listeParCategorie[] = $categorie['moychampion'];
        }
        ?>
        let labelPie = <?= json_encode($listeParCategorie)?>;
        let dataPieChampion= <?= json_encode($listeParChampion)?>;
        let dataPieNumero = <?= json_encode($listeParNumero)?>;


</script>
<script src="JavaScript/script-contenu.js"></script>
<?php
require "../footer.php";
?>