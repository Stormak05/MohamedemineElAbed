<!-- formulaire de connexion membre -->
<form action="membre/traitement-authentification.php" method="post" class="form">
    <div id="erreur">
        <?php if(!empty($_SESSION['erreur'])){
            echo $_SESSION['erreur'];
            unset($_SESSION['erreur']);
        }
        ?>
    </div>
    <div>
        <label for="pseudomyne">Pseudonyme</label>
    <input type="text" name="pseudonyme" id="pseudonyme">
</div>

    <div>
        <label for="motdepasse">Mot de passe</label>
        <input type="password" name="motdepasse" id="motdepasse">
    </div>
    <input type="submit" value="Me connecter" name="membre-authentification">
</form>