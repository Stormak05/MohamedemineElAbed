using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Metadata.Ecma335;
using System.Text;
using System.Threading.Tasks;

namespace TP2_ME
{
    internal class De
    {
        private int desDom;
        private int desAtt;
        private int nbFaces;
        private int valeur;

        /// <summary>
        /// Construit par défaut un dé à 6 faces.
        /// La valeur par défaut à la construction est 1.
        /// </summary>
        public De()
        {
            nbFaces = 6;

            valeur = 1;

            desDom = 0;
            desAtt = 0;
        }

        /// <summary>
        /// Lance le dé et retourne la nouvelle valeur
        /// </summary>
        /// <returns>La nouvelle valeur du dé</returns>

        public int brasser()
        {
            Random aleatoire = new Random();

            this.valeur = aleatoire.Next(1, this.nbFaces + 1);

            return this.valeur;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="nbFaces"></param>
        public De(int nbFaces)
        {
            if (nbFaces >= 6 && nbFaces <= int.MaxValue)
                this.nbFaces = nbFaces;
            else
                this.nbFaces = 6;

            valeur = 1;
        }

        /// <summary>
        /// Permet de savoir le nombre de faces du dé
        /// </summary>
        /// <returns>Le nombre de faces du dé</returns>
        public int getNbFaces()
        {
            return this.nbFaces;
        }

        /// <summary>
        /// Permet d'accéder à la valeur actuelle du dé
        /// </summary>
        /// <returns>La valeur du dé</returns>
        public int getValeur()
        {
            return this.valeur;
        }
    }
}
