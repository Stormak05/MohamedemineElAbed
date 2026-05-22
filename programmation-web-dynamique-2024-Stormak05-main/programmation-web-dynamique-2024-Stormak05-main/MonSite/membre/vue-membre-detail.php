<div id="liste-pilote">
    <div id="pilote">

        <div id="image">
            <img src="images<?= $membre['avatar'] ?>" alt="avatar">
        </div>

        <div class="Membre">
            <h3>Pseudonyme : </h3>
            <p><?= $membre['pseudonyme'] ?></p>
        </div>

        <div class="Membre">
            <h3>Prénom : </h3>
            <p><?= $membre['prenom'] ?></p>
        </div>

        <div class="Membre">
            <h3>Courriel : </h3>
            <p><?= $membre['courriel'] ?></p>
        </div>

    </div>
</div>

<?php
echo "Espace Membre";
?>
<a href="membre/deconnexion.php" class="bouton2">Se déconnecter</a>
<?php
require "footer.php";
?>
