<?php
session_start();

$adresseCourante = (isset($_SERVER['HTTPS']) ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[SCRIPT_NAME]";

$estSurServeurTim = strpos($adresseCourante, 'tiweb.timmatane.ca') !== false ? true : false;

if($estSurServeurTim) {
    define("CHEMIN_ACCESSEUR", $_SERVER['DOCUMENT_ROOT']. "");
} else {
    define("CHEMIN_ACCESSEUR", $_SERVER['DOCUMENT_ROOT']. "/php/TP_ME/MonSite/accesseurs/");
}

?>
