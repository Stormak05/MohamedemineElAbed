<?php
require "../configuration.php";
$titre = "Création compte";
require "header.php";
require CHEMIN_ACCESSEUR . "MembreDAO.php";


if(isset($_POST['inscription-identification'])) {

    if(empty($_POST['prenom']) || empty($_POST['nom'])){
        $_SESSION['erreurIdentification'] = "Veuillez renseigner tout les champs";
        header('Location: inscription-identification.php');
    } else if (empty($_POST['courriel']) || !filter_var($_POST['courriel'], FILTER_VALIDATE_EMAIL)) {
        $_SESSION['erreurIdentification'] = "Veuillez renseigner votre email correctement";
        header('Location: inscription-identification.php');
    } else if (MembreDAO::trouverCourriel(filter_var($_POST['courriel'], FILTER_SANITIZE_EMAIL ))) {
        $_SESSION['erreurIdentification'] = "Courriel non disponible";
        header('Location: inscription-identification.php');
    }
    else {
        $filtreMembre = array(
            'prenom' => FILTER_SANITIZE_SPECIAL_CHARS,
            'nom' => FILTER_SANITIZE_SPECIAL_CHARS,
            'courriel' => FILTER_SANITIZE_EMAIL,
        );
    
        $_SESSION['membre'] = filter_input_array(INPUT_POST, $filtreMembre);
    }


}
?>



<section class="container">
    <h2>Inscription d'un membre - Informations</h2>

    <form action="traitement-inscription.php" method="post" class="form" enctype="multipart/form-data">

    <div class="erreur">
        <?php
        if(!empty($_SESSION['erreurInformation'])) {
            echo $_SESSION['erreurInformation'];
            unset($_SESSION['erreurInformation']);
        }
        ?>
    </div>

        <div id="entree-pseudonyme">
            <label for="pseudonyme">Pseudonyme<label>
            <input type="text" name="pseudonyme" id="pseudonyme">
        </div>

        <div id="entree-motdepasse">
            <label for="motdepasse">Mot de passe</label>
            <input type="password" name="motdepasse" id="motdepasse">
        </div>

        <div id="entree-motdepasse2">
            <label for="motdepasse2">Confirmation du mot de passe</label>
            <input type="password" name="motdepasse2" id="motdepasse2">
        </div>

        <div id="entree-avatar">
            <label for="avatar">Avatar</label>
            <input type="file" name="image" id="avatar">
        </div>

        <input type="submit" name="imageok" value="Enregistrer">

    </form>

</section>
<?php
require "../footer.php";
?>