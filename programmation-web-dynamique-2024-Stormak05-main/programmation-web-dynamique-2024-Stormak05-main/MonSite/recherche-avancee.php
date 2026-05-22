<?php
$titre = "Recherche avancée";
require 'header.php';
?>
<h2>Recherche avancée</h2>

<section id="contenu">
    <div id="container">
        <div class="card border-primary d-flex mb-3 justify-content-center mx-auto p-2" style="max-width: 20rem;">
            <div class="card-body justify-content-center">
                <form action="recherche-avancee-traitement.php" method="get">
                    <div class="form-floating mb-3">
                        <input type="text" name="recherche-nom" class="form-control" id="recherche-nom">
                        <label for="recherche-nom">Nom</label>
                    </div>

                    <div class="form-floating mb-3">
                        <input type="text" name="recherche-numero" class="form-control" id="recherche-numero">
                        <label for="recherche-numero">Numéro</label>
                    </div>

                    <div class="form-floating mb-3">
                        <input type="text" name="recherche-ecurie" class="form-control" id="recherche-ecurie">
                        <label for="recherche-ecurie">Écurie</label>
                    </div>

                    <div class="d-grid gap-2 d-md-block">
                    <button type="submit" class="btn btn-dark">Recherche</button>
                    </div>
                </form>
            </div>
        </div>



    </div>
</section>
<?php
require 'footer.php';
?>