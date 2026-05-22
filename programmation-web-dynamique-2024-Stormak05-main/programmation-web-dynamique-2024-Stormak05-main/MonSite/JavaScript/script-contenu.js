//SELECT AVG(champion) AS moyenne, STDDEV() AS ecart_type FROM formule1
const pieChart = document.querySelector("#pieChart");
      const myChart = new Chart(pieChart, {
        type: "pie",
        data: {
          labels: labelPie,
          datasets: [
            {
              data: dataPieNumero,
              backgroundColor: [
                "orange",
                "yellow",
                "red",
                "blue",
                "green",
                "grey",
              ],
              hoverOffset: 20,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          plugins: {
            title: {
              text: "Films par genre",
              display: true,
              position: "top",
            },
            legend: {
              position: "bottom",
            },
          },
        },
      });


      const anneauChart = document.querySelector("#anneauChart");
      const myChart2 = new Chart(anneauChart, {
        type: "doughnut",
        data: {
          labels: labelPie,
          datasets: [
            {
              data: dataPieNumero,
              backgroundColor: [
                "orange",
                "yellow",
                "red",
                "blue",
                "green",
                "grey",
              ],
              hoverOffset: 20,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          plugins: {
            title: {
              text: "Films par genre",
              display: true,
              position: "top",
            },
            legend: {
              position: "bottom",
            },
          },
        },
      });