import mysql from 'mysql2/promise';

// MySQL connection config
const config = {
  host: 'localhost',
  user: 'root',
  password: '', // Please update with your password or use environment variables
  database: 'itr_system',
  port: 3306,
};

async function insertDummyWalletData() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Starting to insert dummy wallet data...');

    // First, get existing agents
    const [agents] = await connection.execute('SELECT id FROM agent LIMIT 5');
    
    if (agents.length === 0) {
      console.log('No agents found in the database. Please create agents first.');
      return;
    }

    console.log(`Found ${agents.length} agents. Creating sample wallet transactions and updating balances...`);

    // Insert transactions and balances for each agent
    for (let i = 0; i < agents.length; i++) {
      const agentId = agents[i].id;
      const initialBalance = 5000 + (i * 1000); // Different balances for each agent

      // Update agent wbalance
      await connection.execute('UPDATE agent SET wbalance = ? WHERE id = ?', [initialBalance, agentId]);
      console.log(`✓ Set agent ${agentId} balance to ₹${initialBalance}`);

      // Insert initial credit transaction (recharge) referencing agent_id
      await connection.execute(
        `INSERT INTO wallet_transactions 
          (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, description, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agentId,
          agentId,
          'credit',
          initialBalance,
          0,
          initialBalance,
          'recharge',
          'Initial wallet credit for testing',
          'completed'
        ]
      );

      // Insert some sample debit transactions (ITR payments)
      for (let j = 0; j < 2; j++) {
        const paymentAmount = 150 + (j * 50);
        const balanceBefore = initialBalance - (j * paymentAmount);
        const balanceAfter = balanceBefore - paymentAmount;

        // Get a random completed ITR if available
        const [itrs] = await connection.execute(
          'SELECT id FROM itr WHERE agent_id = ? AND status = "Completed" LIMIT 1',
          [agentId]
        );

        if (itrs.length > 0) {
          const itrId = itrs[0].id;

          // Insert debit transaction
          const [txResult] = await connection.execute(
            `INSERT INTO wallet_transactions 
              (agent_id, performed_by, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, description, status) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              agentId,
              agentId,
              'debit',
              paymentAmount,
              balanceBefore,
              balanceAfter,
              'itr_payment',
              itrId,
              `Payment for ITR #${itrId}`,
              'completed'
            ]
          );

          // Insert ITR payment record
          await connection.execute(
            `INSERT INTO itr_payments 
              (itr_id, agent_id, wallet_transaction_id, amount, payment_status) 
              VALUES (?, ?, ?, ?, ?)`,
            [itrId, agentId, txResult.insertId, paymentAmount, 'completed']
          );

          console.log(`  ✓ Added payment transaction of ₹${paymentAmount} for ITR #${itrId}`);
        }
      }
    }

    console.log('\n✅ Dummy wallet data inserted successfully!');
    console.log('\nSummary:');
    console.log(`- Created/Updated ${agents.length} agent wallets`);
    console.log('- Each wallet has initial credit transaction');
    console.log('- Sample ITR payment transactions added where ITRs exist');
    console.log('\nYou can now test the wallet system with this data.');

  } catch (error) {
    console.error('Error inserting dummy data:', error.message);
  } finally {
    await connection.end();
  }
}

insertDummyWalletData();
