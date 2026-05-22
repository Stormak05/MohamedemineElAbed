const lineChart = document.querySelector("#lineChart");
      const graph1 = new Chart(lineChart, {
        type: "line",
        data: {
          labels: labelLine,
          datasets: [
            {
              data: labelLine,
              backgroundColor: ["blue"],
              borderColor: ["blue"],
              label: "Visites par jour",
              fill: true,
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

      const barChart = document.querySelector("#barChart");
      const graph2 = new Chart(barChart, {
        type: "bar",
        data: {
          labels: labelBar,
          datasets: [
            {
              data: dataBar,
              backgroundColor: [
                "orange",
                "yellow",
                "red",
                "blue",
                "green",
                "grey",
              ],
              label: "Clics par langue",
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
        },
      });
