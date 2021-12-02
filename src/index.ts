import express from "express";
import cors from "cors";
import client from "./db";

const app = express();

client.connect().then(() => {
  console.log("Connected to ice-cream-shop database!");
  app.use(express.json());
  app.use(cors());

  app.get("/inventory", async (req, res) => {
    const result = await client.query(
      "SELECT * FROM flavours LEFT JOIN inventory ON flavours.id = inventory.id"
    );
    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  });

  app.get("/inventory/:flavour_id", async (req, res) => {
    const flavourID = parseInt(req.params.flavour_id);
    const result = await client.query(
      "SELECT flavours.*, inventory.quantity FROM flavours LEFT JOIN inventory ON flavours.id = inventory.id WHERE flavours.id = ($1)",
      [flavourID]
    );
    if (result.rowCount !== 0) {
      res.status(200).json({
        status: "success",
        data: result.rows,
      });
    } else {
      res.status(404).json({
        status: "failed",
        message: "The flavour ID does not exist.",
      });
    }
  });

  // Update quantity of a single flavour
  app.put("/inventory/:flavour_id/sales", async (req, res) => {
    const { quantitySold } = req.body;
    const flavourID = parseInt(req.params.flavour_id);
    const amountInStock: number = await client
      .query("SELECT quantity FROM inventory WHERE id = $1", [flavourID])
      .then((res) => res.rows[0].quantity);
    if (quantitySold > amountInStock) {
      res.status(403).json({
        status: "failed",
        message: "Cannot buy more ice cream than the quantity in stock.",
      });
    } else {
      const result = await client.query(
        `UPDATE inventory SET quantity = ${amountInStock}-$1 WHERE id = $2 RETURNING *`,
        [quantitySold, flavourID]
      );

      res.status(200).json({
        status: "success",
        data: result.rows,
      });
    }
  });

  // Adding a flavour to inventory with a specifed amount
  app.post("/inventory/add", async (req, res) => {
    const { flavour, quantityAdded } = req.body;
    const existingFlavours = await client
      .query("SELECT name FROM flavours;")
      .then((res) => res.rows);
    console.log(existingFlavours);
    const flavourArr = existingFlavours.map((item) => item.name.toLowerCase());
    console.log(flavourArr);
    if (flavourArr.includes(flavour)) {
      const amountInStock: number = await client
        .query(
          "SELECT quantity FROM inventory WHERE id = (SELECT id FROM flavours WHERE name = ($1));",
          [flavour]
        )
        .then((res) => res.rows[0].quantity);
      console.log(amountInStock);
      const result = await client.query(
        `UPDATE inventory SET quantity = ${amountInStock}+${parseInt(
          quantityAdded
        )} WHERE id = (SELECT id FROM flavours WHERE name = ($1)) RETURNING *;`,
        [flavour]
      );
      res.status(200).json({
        status: "success",
        data: result.rows,
      });
    } else {
      const result = await client
        .query("INSERT INTO flavours (name) VALUES ($1)", [
          flavour.toLowerCase(),
        ])
        .then(() =>
          client.query(
            "INSERT INTO inventory (id, quantity) VALUES ((SELECT id FROM flavours WHERE name = ($1)), ($2)) RETURNING *",
            [flavour.toLowerCase(), quantityAdded]
          )
        );
      res.status(201).json({
        status: "success",
        data: result.rows,
      });
    }
  });

  // use the environment variable PORT, or 4000 as a fallback
  const PORT_NUMBER = process.env.PORT ?? 4000;

  app.listen(PORT_NUMBER, () => {
    console.log(`Server listening on port ${PORT_NUMBER}!`);
  });
});