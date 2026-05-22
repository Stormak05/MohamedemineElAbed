<?php
require "../configuration.php";

//On ne peux pas détruire la session si le membre n'est pas connecté
if(isset($_SESSION['membre']['pseudonyme'])){
    //On détruit les variables de la session (les vides)
    session_unset();

    //Ensuite on détruit la session
    session_destroy();

    //On retourne à la page d'acceuil.
    header('location: ../liste-pilote.php');
} else {
    echo "Vous n'êtes pas connecté !";
}
?>