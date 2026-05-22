<?php
require "../configuration.php";
require CHEMIN_ACCESSEUR . "MembreDAO.php";

if(isset($_POST['membre-authentification'])) {
    $filtreMembre = array(
        'pseudonyme' => FILTER_SANITIZE_SPECIAL_CHARS,
        'motdepasse' => FILTER_SANITIZE_ENCODED,
    );
    $membre = filter_input_array(INPUT_POST, $filtreMembre);

    $membreTrouve = MembreDAO::trouverMembre($membre);

    //comparaison motdepasse entré par l'utilisateur est le même que celui dans la table membre
    if(!password_verify($membre['pseudonyme'], $membreTrouve['pseudonyme'])) {
        $_SESSION['membre'] = $membreTrouve;
    } else {
        $_SESSION['erreur'] = "Votre pSeudo ou votre mot de passe est invalide. ";
    }
    header('location: ../membre.php');
}
?>